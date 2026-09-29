// Kullanıcının saat dilimindeki "şimdi" ve "HH:MM" yardımcıları.
// Tüm yerel zamanlar "YYYY-MM-DDTHH:MM" string'i olarak taşınır; aynı uzunlukta
// oldukları için string karşılaştırması kronolojik karşılaştırmayla aynıdır.

export interface LocalNow {
  date: string; // "2026-09-30"
  time: string; // "07:45"
  minutes: number; // gece yarısından beri dakika
  weekday: number; // 0 = Pazartesi … 6 = Pazar
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function localNow(timeZone: string, at: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const time = `${get("hour")}:${get("minute")}`;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time,
    minutes: toMinutes(time),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Tarihe dakika ekleyerek yerel ISO üretir: ("2026-09-30", 1500) → "2026-10-01T01:00" */
export function isoAt(date: string, minutes: number): string {
  const dayOffset = Math.floor(minutes / 1440);
  const rest = minutes - dayOffset * 1440;
  const h = String(Math.floor(rest / 60)).padStart(2, "0");
  const m = String(rest % 60).padStart(2, "0");
  return `${addDays(date, dayOffset)}T${h}:${m}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-30T08:15" → "2026-09-30T08:00" */
export function floorHour(iso: string): string {
  return `${iso.slice(0, 13)}:00`;
}

/** Kullanıcının yazdığı saati normalize eder: "7", "7:30", "07.30", "0730", "7 30" → "07:30" */
export function parseTime(input: string): string | null {
  const s = input.trim();
  const m = s.match(/^(\d{1,2})(?:[:.\s]?(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
