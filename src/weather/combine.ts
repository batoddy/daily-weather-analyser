// Ev + iş konumlarını tek saatlik seriye birleştirir; özetleme kodu tek konum varmış gibi çalışır.
//
//   çıkış saati            → ev (evden çıkarken)
//   çıkış ile dönüş arası  → iş (gün içi)
//   dönüş saati            → ikisinin kötüsü (işten çıkış + eve varış)
//   geri kalan saatler     → ev (sabah, akşam, gece)

import { toMinutes } from "../time";
import type { Hour } from "./openmeteo";

export function combineHomeWork(home: Hour[], work: Hour[] | null, leave: string, ret: string): Hour[] {
  if (!work) return home;
  const leaveH = Math.floor(toMinutes(leave) / 60);
  const retH = Math.floor(toMinutes(ret) / 60);
  const byTime = new Map(work.map((h) => [h.time, h]));

  return home.map((h) => {
    const w = byTime.get(h.time);
    if (!w) return h;
    const hour = Number(h.time.slice(11, 13));
    if (hour === leaveH) return h;
    if (hour === retH) return worse(h, w);
    return isWorkHour(hour, leaveH, retH) ? w : h;
  });
}

/** Çıkış ile dönüş arasında mı? (gece yarısını geçen vardiyalar dahil) */
function isWorkHour(hour: number, leaveH: number, retH: number): boolean {
  return retH > leaveH ? hour > leaveH && hour < retH : hour > leaveH || hour < retH;
}

/** İki konumdan giyim/uyarı açısından kötü olanı: daha soğuk, daha yağışlı, daha rüzgarlı. */
export function worse(a: Hour, b: Hour): Hour {
  return {
    time: a.time,
    temp: Math.min(a.temp, b.temp),
    feels: Math.min(a.feels, b.feels),
    precipProb: Math.max(a.precipProb, b.precipProb),
    precip: Math.max(a.precip, b.precip),
    wind: Math.max(a.wind, b.wind),
    gust: Math.max(a.gust, b.gust),
    code: Math.max(a.code, b.code), // WMO kodlarında büyük sayı genelde daha kötü hava
    uv: Math.max(a.uv, b.uv),
  };
}
