// Raporu/uyarıyı uçtan uca üretir ve cron turunu yönetir.

import { advise } from "./advice/advice";
import { isReady, listActive, updateUser, type ReadyUser } from "./db/users";
import { asLang } from "./message/i18n";
import { commentFor } from "./message/llm";
import { composeAlert, composeReport, type ReportInput } from "./message/report";
import { alertWindow, dueActions, reportWindow } from "./schedule";
import { Telegram } from "./telegram";
import { localNow, type LocalNow } from "./time";
import { fetchHours, type Hour } from "./weather/openmeteo";
import { hoursInWindow, rainSpans, severeEvents, summarize } from "./weather/summarize";

/**
 * Ücretsiz planda her cron turu en fazla 50 dış istek (fetch) yapabilir. Bir rapor ≈ 3-4 istek
 * (Open-Meteo aynı konum için paylaşılır + Gemini 1-2 + Telegram 1). Kalanlar 5 dk sonraki tura kalır;
 * mesaj saatinden sonra 2 saat boyunca denendiği için kimse mesajsız kalmaz, sadece birkaç dakika gecikir.
 * Ücretli planda (1000 istek) bu sayı rahatça 100+ yapılabilir.
 */
const MAX_ACTIONS_PER_TICK = 10;

type HoursFetcher = (lat: number, lon: number, tz: string) => Promise<Hour[]>;

/** Aynı cron turunda aynı konum için hava verisini bir kez çeker. */
export function cachedFetcher(): HoursFetcher {
  const cache = new Map<string, Promise<Hour[]>>();
  return (lat, lon, tz) => {
    const key = `${lat},${lon},${tz}`;
    let p = cache.get(key);
    if (!p) {
      p = fetchHours(lat, lon, tz);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return p;
  };
}

export async function buildReport(env: Env, u: ReadyUser, now: LocalNow, fetch: HoursFetcher): Promise<string | null> {
  const window = reportWindow(u, now);
  const hours = await fetch(u.lat, u.lon, u.timezone);
  const summary = summarize(hours, window);
  if (!summary) return null;
  const inp: ReportInput = {
    name: u.name,
    place: u.place_label,
    lang: asLang(u.lang),
    now,
    window,
    summary,
    advice: advise(summary, u.sensitivity),
  };
  return composeReport(inp, await commentFor(env, inp));
}

export async function buildAlert(u: ReadyUser, now: LocalNow, fetch: HoursFetcher): Promise<string | null> {
  const window = alertWindow(u, now);
  const hours = await fetch(u.lat, u.lon, u.timezone);
  const win = hoursInWindow(hours, window);
  if (win.length === 0) return null;
  const gustHour = win.reduce((a, b) => (b.gust > a.gust ? b : a));
  const dayEnd = `${now.date}T23:00`;
  return composeAlert({
    lang: asLang(u.lang),
    place: u.place_label,
    rain: rainSpans(win),
    windMax: Math.round(Math.max(...win.map((h) => h.wind))),
    gustMax: Math.round(gustHour.gust),
    gustTime: gustHour.time.slice(11, 16),
    severe: severeEvents(hoursInWindow(hours, { start: window.start, end: window.end > dayEnd ? window.end : dayEnd })),
  });
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
