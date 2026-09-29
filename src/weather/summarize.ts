// Saatlik veriyi kullanıcının dışarıda olduğu pencereye göre özetler.
// Saf fonksiyonlar: ağ yok, test edilebilir.

import { T } from "../advice/thresholds";
import { addDays, floorHour } from "../time";
import type { Hour } from "./openmeteo";

export interface Window {
  start: string; // yerel "YYYY-MM-DDTHH:MM"
  end: string;
  startsNow?: boolean; // çıkış saati geçmişse pencere "şimdi"den başlar
  tomorrow?: boolean; // bugünün penceresi bittiyse yarının penceresi
}

export interface Point {
  time: string; // "HH:MM"
  temp: number;
  feels: number;
}

export interface RainSpan {
  from: string; // "HH:MM"
  to: string; // "HH:MM" (son yağmurlu saatin bitişi)
  prob: number; // en yüksek olasılık
  mm: number; // toplam
  heavy: boolean;
  snow: boolean;
  minTemp: number;
}

export type SevereKind =
  | "thunderstorm"
  | "hail"
  | "heavy_snow"
  | "freezing_rain"
  | "storm_wind"
  | "extreme_heat"
  | "extreme_cold";

export interface SevereEvent {
  kind: SevereKind;
  from: string;
  to: string;
  value: number; // hamle, hissedilen sıcaklık vb. (türüne göre en uç değer)
}

export type Sky = "clear" | "partly" | "cloudy" | "rain" | "snow" | "storm";

export interface Summary {
  leave: Point;
  peak: Point; // penceredeki en sıcak saat
  coldest: Point; // penceredeki en düşük hissedilen saat
  back: Point;
  minTemp: number;
  maxTemp: number;
  minFeels: number;
  maxFeels: number;
  windMax: number;
  gustMax: number;
  gustTime: string;
  rain: RainSpan[];
  maybeRain: { time: string; prob: number } | null;
  uvMax: number;
  uvTime: string;
  severe: SevereEvent[]; // pencere başından gün sonuna kadar
  yesterdayDiff: number | null; // bugünkü pencere ort. − dünkü aynı saatler ort.
  sky: Sky;
}

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const HEAVY_SNOW_CODES = new Set([75, 86]);
const HEAVY_RAIN_CODES = new Set([65, 82]);
const FREEZING_CODES = new Set([56, 57, 66, 67]);
const THUNDER_CODES = new Set([95, 96, 99]);
const HAIL_CODES = new Set([96, 99]);

export function hoursInWindow(hours: Hour[], w: Window): Hour[] {
  const from = floorHour(w.start);
  return hours.filter((h) => h.time >= from && h.time <= w.end);
}

export function summarize(hours: Hour[], w: Window): Summary | null {
  const win = hoursInWindow(hours, w);
  const first = win[0];
  const last = win[win.length - 1];
  if (!first || !last) return null;

  const peakHour = win.reduce((a, b) => (b.temp > a.temp ? b : a));
  const coldHour = win.reduce((a, b) => (b.feels < a.feels ? b : a));
  const gustHour = win.reduce((a, b) => (b.gust > a.gust ? b : a));
  const uvHour = win.reduce((a, b) => (b.uv > a.uv ? b : a));

  // Aşırı olaylar pencere bitse de gün sonuna kadar taranır (eve dönünce de önemli).
  const dayEnd = `${w.start.slice(0, 10)}T23:00`;
  const severeHours = hoursInWindow(hours, { start: w.start, end: w.end > dayEnd ? w.end : dayEnd });

  return {
    leave: { time: w.start.slice(11), temp: r(first.temp), feels: r(first.feels) },
    peak: { time: hhmm(peakHour.time), temp: r(peakHour.temp), feels: r(peakHour.feels) },
    coldest: { time: hhmm(coldHour.time), temp: r(coldHour.temp), feels: r(coldHour.feels) },
    back: { time: w.end.slice(11), temp: r(last.temp), feels: r(last.feels) },
    minTemp: r(Math.min(...win.map((h) => h.temp))),
    maxTemp: r(Math.max(...win.map((h) => h.temp))),
    minFeels: r(Math.min(...win.map((h) => h.feels))),
    maxFeels: r(Math.max(...win.map((h) => h.feels))),
    windMax: r(Math.max(...win.map((h) => h.wind))),
    gustMax: r(gustHour.gust),
    gustTime: hhmm(gustHour.time),
    rain: rainSpans(win),
    maybeRain: maybeRain(win),
    uvMax: r(uvHour.uv),
    uvTime: hhmm(uvHour.time),
    severe: severeEvents(severeHours),
    yesterdayDiff: yesterdayDiff(hours, win),
    sky: sky(win),
  };
}

export function isRainy(h: Hour): boolean {
  return h.precipProb >= T.rainProb && h.precip >= T.rainMm;
}

export function rainSpans(win: Hour[]): RainSpan[] {
  const spans: RainSpan[] = [];
  let cur: Hour[] = [];
  const flush = () => {
    const a = cur[0];
    const b = cur[cur.length - 1];
    if (a && b) {
      spans.push({
        from: hhmm(a.time),
        to: hhmm(plusHour(b.time)),
        prob: Math.max(...cur.map((h) => h.precipProb)),
        mm: Math.round(cur.reduce((s, h) => s + h.precip, 0) * 10) / 10,
        heavy: cur.some((h) => h.precip >= T.heavyRainMm || HEAVY_RAIN_CODES.has(h.code)),
        snow: cur.some((h) => SNOW_CODES.has(h.code)),
        minTemp: r(Math.min(...cur.map((h) => h.temp))),
      });
    }
    cur = [];
  };
  for (const h of win) {
    if (isRainy(h)) cur.push(h);
    else flush();
  }
  flush();
  return spans;
}

function maybeRain(win: Hour[]): Summary["maybeRain"] {
  if (win.some(isRainy)) return null;
  const top = win.reduce((a, b) => (b.precipProb > a.precipProb ? b : a));
  return top.precipProb >= T.maybeRainProb ? { time: hhmm(top.time), prob: top.precipProb } : null;
}

export function severeEvents(hours: Hour[]): SevereEvent[] {
  const checks: [SevereKind, (h: Hour) => boolean, (h: Hour) => number, "max" | "min"][] = [
    ["thunderstorm", (h) => THUNDER_CODES.has(h.code), (h) => h.gust, "max"],
    ["hail", (h) => HAIL_CODES.has(h.code), (h) => h.gust, "max"],
    ["heavy_snow", (h) => HEAVY_SNOW_CODES.has(h.code), (h) => h.precip, "max"],
    ["freezing_rain", (h) => FREEZING_CODES.has(h.code), (h) => h.temp, "min"],
    ["storm_wind", (h) => h.gust >= T.stormGust, (h) => h.gust, "max"],
    ["extreme_heat", (h) => h.feels >= T.extremeHeatFeels, (h) => h.feels, "max"],
    ["extreme_cold", (h) => h.feels <= T.extremeColdFeels, (h) => h.feels, "min"],
  ];
  const events: SevereEvent[] = [];
  for (const [kind, test, value, pick] of checks) {
    let run: Hour[] = [];
    const flush = () => {
      const a = run[0];
      const b = run[run.length - 1];
      if (a && b) {
        const values = run.map(value);
        events.push({
          kind,
          from: hhmm(a.time),
          to: hhmm(plusHour(b.time)),
          value: r(pick === "max" ? Math.max(...values) : Math.min(...values)),
        });
      }
      run = [];
    };
    for (const h of hours) {
      if (test(h)) run.push(h);
      else flush();
    }
    flush();
  }
  return events.sort((a, b) => a.from.localeCompare(b.from));
}

function yesterdayDiff(all: Hour[], win: Hour[]): number | null {
  const byTime = new Map(all.map((h) => [h.time, h]));
  const diffs: number[] = [];
  for (const h of win) {
    const y = byTime.get(`${addDays(h.time.slice(0, 10), -1)}${h.time.slice(10)}`);
    if (y) diffs.push(h.temp - y.temp);
  }
  if (diffs.length < win.length / 2) return null;
  return Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length);
}

function sky(win: Hour[]): Sky {
  if (win.some((h) => THUNDER_CODES.has(h.code))) return "storm";
  if (win.some((h) => SNOW_CODES.has(h.code) && isRainy(h))) return "snow";
  if (win.some(isRainy)) return "rain";
  const avg = win.reduce((s, h) => s + Math.min(h.code, 3), 0) / win.length;
  return avg < 1 ? "clear" : avg < 2.2 ? "partly" : "cloudy";
}

function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

function plusHour(iso: string): string {
  const h = Number(iso.slice(11, 13)) + 1;
  return h >= 24 ? `${addDays(iso.slice(0, 10), 1)}T00:00` : `${iso.slice(0, 11)}${String(h).padStart(2, "0")}:00`;
}

function r(n: number): number {
  return Math.round(n);
}
