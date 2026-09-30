// Raporu/uyarıyı uçtan uca üretir ve cron turunu yönetir.

import { advise } from "./advice/advice";
import { isReady, listActive, updateUser, type ReadyUser } from "./db/users";
import { asLang } from "./message/i18n";
import { commentFor } from "./message/llm";
import { composeAlert, composeReport, type ReportInput } from "./message/report";
import { alertWindow, dueActions, reportWindow } from "./schedule";
import { Telegram } from "./telegram";
import { localNow, type LocalNow } from "./time";
import { cityEvents, cityGrid } from "./weather/city";
import { combineHomeWork } from "./weather/combine";
import { fetchHoursMulti, type Hour, type Point } from "./weather/openmeteo";
import { hoursInWindow, rainSpans, severeEvents, summarize, type Window } from "./weather/summarize";

/**
 * Ücretsiz planda her cron turu en fazla 50 dış istek (fetch) yapabilir. Bir rapor ≈ 3-4 istek
 * (Open-Meteo tek istekte ev + iş + şehir ızgarası + Gemini 1-2 + Telegram 1). Kalanlar 5 dk sonraki tura kalır;
 * mesaj saatinden sonra 2 saat boyunca denendiği için kimse mesajsız kalmaz, sadece birkaç dakika gecikir.
 * Ücretli planda (1000 istek) bu sayı rahatça 100+ yapılabilir.
 */
const MAX_ACTIONS_PER_TICK = 10;

export interface UserWeather {
  hours: Hour[]; // ev + iş saatlere göre birleştirilmiş seri
  grid: Hour[][]; // şehir ızgarası (yoğun yağış vb. notu için)
}

export type WeatherFetcher = (u: ReadyUser) => Promise<UserWeather>;

/** Ev, iş ve şehir ızgarasını tek istekte çeker; aynı cron turunda aynı konumlar için tekrar çekmez. */
export function cachedFetcher(): WeatherFetcher {
  const cache = new Map<string, Promise<Hour[][]>>();
  return async (u) => {
    const home: Point = { lat: u.lat, lon: u.lon };
    const work: Point | null = u.work_lat !== null && u.work_lon !== null ? { lat: u.work_lat, lon: u.work_lon } : null;
    const points = [home, ...(work ? [work] : []), ...cityGrid(home)];
    const key = `${u.timezone}|${points.map((p) => `${p.lat},${p.lon}`).join(";")}`;
    let p = cache.get(key);
    if (!p) {
      p = fetchHoursMulti(points, u.timezone);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    const [homeHours = [], ...rest] = await p;
    const workHours = work ? (rest.shift() ?? null) : null;
    return { hours: combineHomeWork(homeHours, workHours, u.leave_time, u.return_time), grid: rest };
  };
}

export async function buildReport(env: Env, u: ReadyUser, now: LocalNow, fetch: WeatherFetcher): Promise<string | null> {
  const inp = await reportInput(u, now, fetch);
  return inp ? composeReport(inp, await commentFor(env, inp)) : null;
}

/** Raporun tüm girdileri (hava, özet, karar); mesaj metni hariç. Önizleme de bunu kullanır. */
export async function reportInput(u: ReadyUser, now: LocalNow, fetch: WeatherFetcher): Promise<ReportInput | null> {
  const window = reportWindow(u, now);
  const { hours, grid } = await fetch(u);
  const summary = summarize(hours, window);
  if (!summary) return null;
  return {
    name: u.name,
    place: u.place_label,
    work: u.work_label,
    city: { name: cityName(u.place_label), events: cityEvents(grid, { start: window.start, end: dayEnd(window) }) },
    lang: asLang(u.lang),
    now,
    window,
    summary,
    advice: advise(summary, u.sensitivity),
  };
}

export async function buildAlert(u: ReadyUser, now: LocalNow, fetch: WeatherFetcher): Promise<string | null> {
  const window = alertWindow(u, now);
  const { hours } = await fetch(u);
  const win = hoursInWindow(hours, window);
  if (win.length === 0) return null;
  const gustHour = win.reduce((a, b) => (b.gust > a.gust ? b : a));
  return composeAlert({
    lang: asLang(u.lang),
    place: u.work_label ? `${u.place_label ?? "—"} · ${u.work_label}` : u.place_label,
    rain: rainSpans(win),
    windMax: Math.round(Math.max(...win.map((h) => h.wind))),
    gustMax: Math.round(gustHour.gust),
    gustTime: gustHour.time.slice(11, 16),
    severe: severeEvents(hoursInWindow(hours, { start: window.start, end: dayEnd(window) })),
  });
}

/** Pencere günün sonuna (23:00) kadar uzatılır; aşırı olaylar eve dönünce de önemli. */
function dayEnd(w: Window): string {
  const end = `${w.start.slice(0, 10)}T23:00`;
  return w.end > end ? w.end : end;
}

/** "Sütlüce Mahallesi, Beyoğlu, İstanbul" → "İstanbul" */
function cityName(label: string | null): string | null {
  return label?.split(", ").at(-1) ?? null;
}

export async function runSchedule(env: Env): Promise<void> {
  const tg = Telegram.fromEnv(env);
  const fetch = cachedFetcher();
  let budget = MAX_ACTIONS_PER_TICK;

  for (const u of await listActive(env.DB)) {
    if (budget <= 0) break;
    if (!isReady(u)) continue;
    const now = localNow(u.timezone);
    const due = dueActions(u, now);

    if (due.report) {
      budget--;
      await attempt(env, u, "report", async () => {
        const text = await buildReport(env, u, now, fetch);
        if (text) await tg.send(u.chat_id, text);
        await updateUser(env.DB, u.chat_id, { last_report_date: now.date });
      });
    } else if (due.alert) {
      budget--;
      await attempt(env, u, "alert", async () => {
        const text = await buildAlert(u, now, fetch);
        if (text) await tg.send(u.chat_id, text);
        await updateUser(env.DB, u.chat_id, { last_alert_date: now.date });
      });
    }
  }
}

/** Hata olursa tarih işaretlenmez, sonraki turda (5 dk sonra) tekrar denenir. */
async function attempt(env: Env, u: ReadyUser, what: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`${what} → ${u.chat_id} ✓`);
  } catch (e) {
    const msg = String(e);
    console.error(`${what} → ${u.chat_id} ✗ ${msg}`);
    // Kullanıcı botu engellediyse ya da hesabı silindiyse durdur
    if (/blocked by the user|user is deactivated|chat not found/i.test(msg)) {
      await updateUser(env.DB, u.chat_id, { status: "paused" });
    }
  }
}
