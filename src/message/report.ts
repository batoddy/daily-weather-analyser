// Mesajın parçaları. Çıktı Telegram HTML parse_mode içindir.
//
//   🧥 MONT  ·  ☔ ŞEMSİYE              ← başlık: bildirim önizlemesinde görünür
//   ━━━━━━━━━━━━━━
//   🌡️ 9° ➜ 14° ➜ 8° (hissedilen 5°–13°) ← tek bakışta gün (koddan)
//   ☔ 17:00–19:00 yağmur
//
//   ☀️ Günaydın Batuhan!
//   Samimi 1-2 cümle                     ← yorum (LLM veya şablon)
//
//   ▸ Detaylar (açılır blok)              ← saat saat sayılar (koddan)

import type { Advice } from "../advice/advice";
import { T } from "../advice/thresholds";
import type { LocalNow } from "../time";
import type { RainSpan, SevereEvent, Summary, Window } from "../weather/summarize";
import type { CityEvent } from "../weather/city";
import { cityGlance, GLANCE, headline, rainGlance, severeLines as severeGlance, windGlance } from "./glance";
import { SKY_EMOJI, STRINGS, type Lang } from "./i18n";

export interface ReportInput {
  name: string;
  place: string | null; // ev
  work?: string | null; // iş/okul; yoksa evden çalışıyor
  city?: { name: string | null; events: CityEvent[] }; // şehir geneli yoğun yağış vb.
  lang: Lang;
  now: LocalNow;
  window: Window;
  summary: Summary;
  advice: Advice;
}

export function composeReport(inp: ReportInput, comment: string): string {
  const g = GLANCE[inp.lang];
  const greeting = inp.window.tomorrow ? g.tomorrow : g.greeting(escapeHtml(inp.name), Math.floor(inp.now.minutes / 60));
  return [
    ...headline(inp.lang, inp.advice, inp.summary.severe),
    "━━━━━━━━━━━━━━",
    ...glanceLines(inp),
    "",
    greeting,
    escapeHtml(comment),
    "",
    `<blockquote expandable>${placeDate(inp)}\n${factsBlock(inp)}</blockquote>`,
  ].join("\n");
}

/** Tek bakışta gün: sıcaklık seyri, dünle fark, yağmur, rüzgar, katman, güneş. */
export function glanceLines({ lang, window, summary: sm, advice, city }: ReportInput): string[] {
  const g = GLANCE[lang];
  // Çıkış → (en sıcak / en soğuk, zaman sırasıyla) → dönüş; art arda aynı değerler tek yazılır
  const middle = [showPeak(sm) ? sm.peak : null, showColdest(sm) ? sm.coldest : null]
    .filter((p): p is Summary["peak"] => p !== null)
    .sort((a, b) => a.time.localeCompare(b.time));
  const points = [sm.leave, ...middle];
  if (sm.back.time.slice(0, 2) !== sm.leave.time.slice(0, 2)) points.push(sm.back);
  const temps = points.map((p) => p.temp).filter((t, i, all) => i === 0 || t !== all[i - 1]);
  const feels = sm.minFeels === sm.maxFeels ? `${sm.minFeels}°` : `${sm.minFeels}°–${sm.maxFeels}°`;

  const lines = [`🌡️ <b>${temps.join("° ➜ ")}°</b>  (${g.feels} ${feels})`];
  if (sm.yesterdayDiff !== null && Math.abs(sm.yesterdayDiff) >= T.yesterdayDiff) {
    lines.push(g.diff(sm.yesterdayDiff, !!window.tomorrow));
  }
  lines.push(...rainGlance(lang, sm.rain));
  if (sm.maybeRain) lines.push(g.maybeRain(sm.maybeRain.time, sm.maybeRain.prob));
  const cityLine = city ? cityGlance(lang, city.name, city.events, sm) : null;
  if (cityLine) lines.push(cityLine);
  const wind = windGlance(lang, {
    cool: advice.reasons.includes("wind_colder"),
    windy: advice.reasons.includes("wind_colder") || advice.reasons.includes("breezy_warm"),
    gustMax: sm.gustMax,
    gustTime: sm.gustTime,
  });
  if (wind) lines.push(wind);
  if (advice.items.includes("layers")) lines.push(g.layers(sm.maxTemp - sm.minTemp));
  if (advice.items.includes("sunscreen")) lines.push(g.uv(sm.uvMax));
  return lines;
}

/** "☁️ Salı, 30 Eylül" + ev / iş satırı */
export function placeDate({ place, work, lang, window, summary }: ReportInput): string {
  const s = STRINGS[lang];
  const d = new Date(`${window.start.slice(0, 10)}T12:00:00Z`);
  const weekday = s.weekdays[(d.getUTCDay() + 6) % 7];
  const date =
    lang === "tr"
      ? `${weekday}, ${d.getUTCDate()} ${s.months[d.getUTCMonth()]}`
      : `${weekday}, ${s.months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const where = work
    ? `
🏠 ${escapeHtml(place ?? "—")} · 🏢 ${escapeHtml(work)}`
    : place
      ? `
🏠 ${escapeHtml(place)}`
      : "";
  return `${SKY_EMOJI[summary.sky]} <b>${date}</b>${where}`;
}

const MIN_POINT_DIFF = 2;

/** En sıcak an çıkış/dönüşten farklı saatte ve belirgin sıcaksa gösterilir. */
function showPeak(sm: Summary): boolean {
  const hourOf = (t: string) => t.slice(0, 2);
  return (
    hourOf(sm.peak.time) !== hourOf(sm.leave.time) &&
    hourOf(sm.peak.time) !== hourOf(sm.back.time) &&
    sm.peak.temp - Math.max(sm.leave.temp, sm.back.temp) >= MIN_POINT_DIFF
  );
}

/** En soğuk an (hissedilen) çıkış/dönüşten farklı saatte ve belirgin soğuksa gösterilir. */
function showColdest(sm: Summary): boolean {
  const hourOf = (t: string) => t.slice(0, 2);
  return (
    hourOf(sm.coldest.time) !== hourOf(sm.leave.time) &&
    hourOf(sm.coldest.time) !== hourOf(sm.back.time) &&
    sm.coldest.time !== sm.peak.time &&
    Math.min(sm.leave.feels, sm.back.feels) - sm.coldest.feels >= MIN_POINT_DIFF
  );
}

/** Detay bloğu: saat saat sıcaklıklar ve ham sayılar. */
export function factsBlock({ lang, window, summary: sm, advice }: ReportInput): string {
  const s = STRINGS[lang];
  const point = (emoji: string, label: string, p: { time: string; temp: number; feels: number }) =>
    `${emoji} ${label} ${p.time}: <b>${p.temp}°</b>, ${s.feels} ${p.feels}°`;

  const lines = [point(window.startsNow ? "🕒" : "🚪", window.startsNow ? s.now : s.leave, sm.leave)];
  // En sıcak / en soğuk an, çıkış ve dönüşten belirgin farklıysa ayrıca gösterilir (zaman sırasıyla)
  const hourOf = (t: string) => t.slice(0, 2);
  const middle: [string, string, typeof sm.peak][] = [];
  if (showPeak(sm)) middle.push(["🔆", s.peak, sm.peak]);
  if (showColdest(sm)) middle.push(["🥶", s.coldest, sm.coldest]);
  middle.sort((a, b) => a[2].time.localeCompare(b[2].time));
  for (const [emoji, label, p] of middle) lines.push(point(emoji, label, p));
  if (hourOf(sm.back.time) !== hourOf(sm.leave.time)) lines.push(point("🏠", s.back, sm.back));

  if (sm.yesterdayDiff !== null) lines.push(s.vsYesterday(sm.yesterdayDiff, !!window.tomorrow));

  const windy = advice.reasons.includes("wind_colder") || advice.reasons.includes("breezy_warm");
  if (windy || sm.gustMax >= T.gustNoUmbrella) lines.push(s.wind(sm.windMax, sm.gustMax, sm.gustTime));

  lines.push(...rainLines(sm.rain, lang));
  if (sm.maybeRain) lines.push(s.maybeRain(sm.maybeRain.time, sm.maybeRain.prob));
  if (advice.items.includes("sunscreen")) lines.push(s.uv(sm.uvMax, sm.uvTime));
  return lines.join("\n");
}

export function templateComment({ lang, summary: sm, advice }: ReportInput): string {
  const s = STRINGS[lang];
  const parts: string[] = [];
  for (const r of advice.reasons) parts.push(s.reason(r, sm.maxTemp));
  parts.push(s.clothing(advice.tier, advice));
  const ctx = { rainSpans: formatSpans(sm.rain), swing: sm.maxTemp - sm.minTemp };
  for (const i of advice.items) parts.push(s.item(i, ctx));
  if (sm.severe.length > 0) parts.push(s.severeAdvice);
  return parts.join(" ");
}

/** LLM çıktısında değinilmesi zorunlu konular: her grup için anahtar kelimelerden biri geçmeli. */
export function mustMention({ lang, summary: sm, advice }: ReportInput): string[][] {
  const s = STRINGS[lang];
  const groups: string[][] = [s.kwTier[advice.tier]];
  for (const r of advice.reasons) groups.push(s.kwReason[r]);
  if (advice.windproof) groups.push(s.kwWindproof);
  for (const i of advice.items) groups.push(s.kwItem[i]);
  for (const e of sm.severe) groups.push(s.kwSevere[e.kind]);
  return groups;
}

/** LLM'e giden veri: sayılar + değiştirilemez karar + şablon taslak. */
export function llmFacts(inp: ReportInput) {
  const { lang, window, summary: sm, advice } = inp;
  const s = STRINGS[lang];
  return {
    language: lang === "tr" ? "Türkçe" : "English",
    window: { from: window.start.slice(11), to: window.end.slice(11), tomorrow: !!window.tomorrow },
    temperatures: { leave: sm.leave, warmest: sm.peak, coldest: sm.coldest, back: sm.back },
    min_feels_like: sm.minFeels,
    max_temp: sm.maxTemp,
    min_temp: sm.minTemp,
    vs_yesterday: sm.yesterdayDiff,
    wind_kmh: { max_mean: sm.windMax, max_gust: sm.gustMax, gust_time: sm.gustTime },
    rain: sm.rain.map(({ from, to, prob, mm, heavy, snow }) => ({ from, to, prob, mm, heavy, snow })),
    maybe_rain: sm.maybeRain,
    uv_max: sm.uvMax,
    severe_events: sm.severe.map((e) => ({ from: e.from, to: e.to, what: s.severe(e.kind, e.value) })),
    decision: {
      clothing: s.clothing(advice.tier, advice),
      reasons: advice.reasons.map((r) => s.reason(r, sm.maxTemp)),
      items: advice.items.map((i) =>
        s.item(i, { rainSpans: formatSpans(sm.rain), swing: sm.maxTemp - sm.minTemp }),
      ),
    },
    draft: templateComment(inp),
  };
}

// ---------------------------------------------------------------------------
// Gün içi uyarı
// ---------------------------------------------------------------------------

export interface AlertInput {
  lang: Lang;
  place: string | null;
  rain: RainSpan[];
  windMax: number;
  gustMax: number;
  gustTime: string;
  severe: SevereEvent[];
}

/** Uyarılacak bir şey yoksa null. */
export function composeAlert(a: AlertInput): string | null {
  const s = STRINGS[a.lang];
  const windy = a.gustMax >= T.alertGust; // çok sert rüzgar (yılda ~12 gün); fırtına zaten severe'da
  if (a.rain.length === 0 && !windy && a.severe.length === 0) return null;

  // İlk satır bildirimde görünür: en önemli olay en üstte
  const lines = [...severeGlance(a.lang, a.severe), ...rainGlance(a.lang, a.rain)];
  const windLine = windy ? windGlance(a.lang, { cool: false, windy: true, gustMax: a.gustMax, gustTime: a.gustTime }) : null;
  if (windLine) lines.push(windLine);
  lines.push("");
  if (a.rain.length > 0) lines.push(a.gustMax >= T.gustNoUmbrella ? s.alertRaincoat : s.alertUmbrella);
  if (a.severe.length > 0 || windy) lines.push(s.alertCareful);

  const details = [
    ...rainLines(a.rain, a.lang),
    ...(windy ? [s.wind(a.windMax, a.gustMax, a.gustTime)] : []),
    ...a.severe.map((e) => `⚠️ ${e.from}–${e.to} ${s.severe(e.kind, e.value)}`)];
  const footer = `<i>${GLANCE[a.lang].alertFooter}${a.place ? ` · ${escapeHtml(a.place)}` : ""}</i>`;
  if (details.length > 0) lines.push("", `<blockquote expandable>${details.join("\n")}\n${footer}</blockquote>`);
  else lines.push("", footer);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------

function rainLines(rain: RainSpan[], lang: Lang): string[] {
  const s = STRINGS[lang];
  return rain.map((r) => s.rain(r.from, r.to, r.prob, formatMm(r.mm, lang), r.heavy, r.snow));
}

function formatSpans(rain: RainSpan[]): string {
  return rain.map((r) => `${r.from}–${r.to}`).join(", ");
}

function formatMm(mm: number, lang: Lang): string {
  return lang === "tr" ? String(mm).replace(".", ",") : String(mm);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
