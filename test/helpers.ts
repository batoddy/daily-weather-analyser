import type { Hour } from "../src/weather/openmeteo";

/** Dün + bugün + yarın için saatlik veri üretir; `over` ile belirli saatleri ezer. */
export function makeHours(
  today: string,
  base: Partial<Hour>,
  over: Record<string, Partial<Hour>> = {},
  yesterdayBase: Partial<Hour> = base,
): Hour[] {
  const days = [shift(today, -1), today, shift(today, 1)];
  const hours: Hour[] = [];
  for (const day of days) {
    for (let h = 0; h < 24; h++) {
      const time = `${day}T${String(h).padStart(2, "0")}:00`;
      const b = day < today ? yesterdayBase : base;
      hours.push({
        time,
        temp: 15,
        feels: 15,
        precipProb: 0,
        precip: 0,
        wind: 5,
        gust: 10,
        code: 0,
        uv: 0,
        ...b,
        ...over[time],
      });
    }
  }
  return hours;
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
