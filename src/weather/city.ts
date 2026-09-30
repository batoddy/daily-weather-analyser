// Şehir geneli: kişinin konumlarında olmasa da şehrin başka yerlerinde yoğun yağış / fırtına var mı?
// Evin çevresinde ~20 km'lik 3x3 ızgaradaki 8 nokta taranır. Tek noktadaki gürültü uyarı üretmesin
// diye bir saatin sayılması için en az 2 noktada görülmesi gerekir. Rüzgar bilinçli olarak yok.

import { T } from "../advice/thresholds";
import type { Hour, Point } from "./openmeteo";
import { hoursInWindow, type Window } from "./summarize";

export type CityKind = "heavy_rain" | "thunderstorm" | "hail" | "heavy_snow" | "freezing_rain";

export interface CityEvent {
  kind: CityKind;
  from: string; // "HH:MM"
  to: string;
}

const LAT_STEP = 0.2; // ~22 km
const LON_STEP = 0.25; // ~21 km (41° enlemde)
export const MIN_POINTS = 2;

export function cityGrid(center: Point): Point[] {
  const points: Point[] = [];
  for (const dLat of [-LAT_STEP, 0, LAT_STEP]) {
    for (const dLon of [-LON_STEP, 0, LON_STEP]) {
      if (dLat === 0 && dLon === 0) continue; // merkez = kişinin kendi konumu, zaten ayrıca bakılıyor
      points.push({ lat: round2(center.lat + dLat), lon: round2(center.lon + dLon) });
    }
  }
  return points;
}

const TESTS: [CityKind, (h: Hour) => boolean][] = [
  ["heavy_rain", (h) => h.precipProb >= T.rainProb && (h.precip >= T.heavyRainMm || h.code === 65 || h.code === 82)],
  ["thunderstorm", (h) => h.code === 95],
  ["hail", (h) => h.code === 96 || h.code === 99],
  ["heavy_snow", (h) => h.code === 75 || h.code === 86],
  ["freezing_rain", (h) => [56, 57, 66, 67].includes(h.code)],
];

export function cityEvents(grid: Hour[][], window: Window): CityEvent[] {
  const series = grid.map((hours) => hoursInWindow(hours, window));
  const times = series[0]?.map((h) => h.time) ?? [];
  const events: CityEvent[] = [];

  for (const [kind, test] of TESTS) {
    let run: string[] = [];
    const flush = () => {
      const a = run[0];
      const b = run[run.length - 1];
      if (a && b) events.push({ kind, from: a.slice(11, 16), to: plusHour(b.slice(11, 16)) });
      run = [];
    };
    times.forEach((time, i) => {
      const hits = series.filter((s) => s[i] && test(s[i]!)).length;
      if (hits >= MIN_POINTS) run.push(time);
      else flush();
    });
    flush();
  }
  return events.sort((a, b) => a.from.localeCompare(b.from));
}

function plusHour(hhmm: string): string {
  const h = (Number(hhmm.slice(0, 2)) + 1) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
