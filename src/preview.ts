// Lokal önizleme: tarayıcıda raporu, Gemini yorumunu, doğrulamayı ve gün içi uyarıyı gösterir.
// Sadece localhost'tan erişilebilir (index.ts kontrol eder).
//   /preview?yer=Kadıköy&cikis=08:15&donus=19:00
//   /preview?lat=56.95&lon=24.11&dil=en&hassasiyet=1&saat=07:30

import { advise } from "./advice/advice";
import type { ReadyUser } from "./db/users";
import { asLang } from "./message/i18n";
import { comment } from "./message/llm";
import { composeReport, escapeHtml, type ReportInput } from "./message/report";
import { reportWindow } from "./schedule";
import { buildAlert, cachedFetcher } from "./service";
import { localNow, parseTime, toMinutes } from "./time";
import { reverseLabel, searchPlaces } from "./weather/geocode";
import { lookupTimezone } from "./weather/openmeteo";
import { summarize } from "./weather/summarize";

export async function preview(url: URL, env: Env): Promise<Response> {
  const q = url.searchParams;
  const lang = asLang(q.get("dil"));
  const leave = parseTime(q.get("cikis") ?? "") ?? "08:15";
  const ret = parseTime(q.get("donus") ?? "") ?? "19:00";
  const sensitivity = Math.max(-1, Math.min(1, Number(q.get("hassasiyet") ?? 0) || 0));

  // Konum: yer adı ya da lat/lon (varsayılan Kadıköy)
  let lat = Number(q.get("lat"));
  let lon = Number(q.get("lon"));
  let place: string | null = null;
  const placeQuery = q.get("yer") ?? (q.has("lat") ? null : "Kadıköy, İstanbul");
  if (placeQuery) {
    const found = (await searchPlaces(placeQuery, lang))[0];
    if (!found) return page("Bulunamadı", `<p>"${escapeHtml(placeQuery)}" için sonuç yok.</p>`);
    ({ lat, lon } = found);
    place = found.label;
  } else {
    place = await reverseLabel(lat, lon, lang);
  }
  const timezone = await lookupTimezone(lat, lon);

  // Saat simülasyonu: ?saat=07:30 → bugün 07:30'daymış gibi
  const now = localNow(timezone);
  const simTime = parseTime(q.get("saat") ?? "");
  if (simTime) Object.assign(now, { time: simTime, minutes: toMinutes(simTime) });

  const user: ReadyUser = {
    chat_id: 0,
    name: q.get("isim") ?? "Batuhan",
    lang,
    lat,
    lon,
    timezone,
    place_label: place,
    notify_time: "07:00",
    leave_time: leave,
    return_time: ret,
    days: "1111111",
    sensitivity,
    status: "active",
    step: null,
    pending_places: null,
    last_report_date: null,
    last_alert_date: null,
    created_at: "",
  };

  const fetch = cachedFetcher();
  const window = reportWindow(user, now);
  const summary = summarize(await fetch(lat, lon, timezone), window);
  if (!summary) return page("Veri yok", "<p>Bu pencere için hava verisi yok.</p>");
  const inp: ReportInput = { name: user.name, place, lang, now, window, summary, advice: advise(summary, sensitivity) };
  const c = await comment(env, inp);
  const report = composeReport(inp, c.text);
  const alert = await buildAlert(user, now, fetch);

  const attempts = c.attempts
    .map(
      (a, i) => `<div class="attempt ${a.problems.length ? "bad" : "ok"}">
        <b>${i + 1}. deneme</b> ${a.problems.length ? "❌ reddedildi" : "✅ kabul edildi"}
        ${a.raw !== null ? `<pre>${escapeHtml(a.raw)}</pre>` : ""}
        ${a.problems.length ? `<ul>${a.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}
      </div>`,
    )
    .join("");

  const source =
    c.source === "llm"
      ? `✅ Gemini (<code>${escapeHtml(env.GEMINI_MODEL)}</code>)`
      : env.GEMINI_API_KEY
        ? "⚠️ Şablon: Gemini'nin cevabı doğrulamadan geçmedi ya da hata verdi"
        : "⚠️ Şablon: GEMINI_API_KEY boş";

  return page(
    "Önizleme",
    `<p class="meta">📍 ${escapeHtml(place ?? `${lat}, ${lon}`)} · ${lat.toFixed(2)}, ${lon.toFixed(2)} · ${timezone}
      · saat ${now.time}${simTime ? " (simüle)" : ""} · pencere ${window.start.slice(11)}–${window.end.slice(11)}${window.tomorrow ? " (yarın)" : ""}</p>

    <h2>Sabah mesajı</h2>
    <div class="bubble">${report}</div>
    <p>Yorum kaynağı: ${source}</p>
    ${attempts}

    <h2>Gün içi uyarı <small>(/uyari şu an bunu derdi)</small></h2>
    <div class="bubble">${alert ?? "<i>Uyarılacak bir şey yok, mesaj gönderilmezdi.</i>"}</div>

    <h2>Kural motoru</h2>
    <pre>${escapeHtml(JSON.stringify(inp.advice, null, 2))}</pre>
    <details><summary>Özet veri</summary><pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre></details>

    <h2>Denemek için</h2>
    <ul>
      <li><a href="?yer=Kadıköy&cikis=08:15&donus=19:00&saat=07:30">Kadıköy, sabah 07:30'daymış gibi</a></li>
      <li><a href="?yer=Riga&dil=en&hassasiyet=1">Riga, İngilizce, çabuk üşüyen</a></li>
      <li><a href="?yer=Ankara&cikis=07:00&donus=23:00">Ankara, uzun gün</a></li>
    </ul>
    <p class="meta">Parametreler: yer · lat/lon · cikis · donus · dil (tr/en) · hassasiyet (-1/0/1) · saat · isim</p>`,
  );
}

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Hava Botu</title>
<style>
  :root { --bg:#f4f5f7; --fg:#1d1f23; --muted:#6b7078; --card:#fff; --ok:#1f8a4c; --bad:#c0392b; --bubble:#e6f3ff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#16181c; --fg:#e8eaed; --muted:#9aa0a6; --card:#1f2227; --bubble:#1e3a52; } }
  body { font: 15px/1.5 system-ui, sans-serif; background: var(--bg); color: var(--fg); max-width: 760px; margin: 0 auto; padding: 16px; }
  h2 { margin-top: 28px; font-size: 17px; } small { color: var(--muted); font-weight: normal; }
  .bubble { background: var(--bubble); border-radius: 12px; padding: 12px 14px; white-space: pre-wrap; }
  pre { background: var(--card); padding: 10px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; font-size: 13px; }
  .attempt { background: var(--card); border-left: 4px solid var(--ok); padding: 8px 12px; margin: 8px 0; border-radius: 6px; }
  .attempt.bad { border-color: var(--bad); }
  .meta { color: var(--muted); font-size: 13px; } a { color: inherit; }
  .bubble blockquote { margin: 8px 0 0; padding: 6px 10px; border-left: 3px solid #4a90d9; background: rgba(127,127,127,.08); border-radius: 4px; white-space: pre-wrap; }
  .bubble blockquote::before { content: "▸ Detaylar (Telegram'da dokununca açılır)"; display: block; font-size: 12px; opacity: .6; }
</style></head><body><h1>🌤️ ${title}</h1>${body}</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
