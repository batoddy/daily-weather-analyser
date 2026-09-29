// Kime, ne zaman, hangi mesaj gidecek? Saf fonksiyonlar, test edilebilir.

import type { ReadyUser } from "./db/users";
import { addDays, isoAt, toMinutes, type LocalNow } from "./time";
import type { Window } from "./weather/summarize";

/** Sabah raporu mesaj saatinden sonra bu kadar dakika içinde gönderilebilir (cron gecikmesi/hata toleransı). */
export const REPORT_GRACE_MIN = 120;
/** Gün içi uyarı dönüşten bu kadar önce kontrol edilir… */
export const ALERT_BEFORE_RETURN_MIN = 120;
/** …ama sabah mesajından en az bu kadar sonra. */
export const ALERT_AFTER_NOTIFY_MIN = 120;

type Times = Pick<ReadyUser, "notify_time" | "leave_time" | "return_time">;

function spans(u: Times) {
  const notify = toMinutes(u.notify_time);
  const leave = toMinutes(u.leave_time);
  let ret = toMinutes(u.return_time);
  if (ret <= leave) ret += 1440; // gece yarısını geçen dönüş
  return { notify, leave, ret };
}

/** Raporun kapsadığı pencere: bugün çıkış→dönüş; çıkış geçtiyse şimdi→dönüş; dönüş de geçtiyse yarın. */
export function reportWindow(u: Times, now: LocalNow): Window {
  const { leave, ret } = spans(u);
  if (now.minutes < ret) {
    if (now.minutes > leave) {
      return { start: isoAt(now.date, now.minutes), end: isoAt(now.date, ret), startsNow: true };
    }
    return { start: isoAt(now.date, leave), end: isoAt(now.date, ret) };
  }
  const tomorrow = addDays(now.date, 1);
  return { start: isoAt(tomorrow, leave), end: isoAt(tomorrow, ret), tomorrow: true };
}

/** Gün içi uyarının kontrol edileceği dakika; bu kullanıcı için uygun değilse null. */
export function alertMinute(u: Times): number | null {
  const { notify, leave, ret } = spans(u);
  const at = Math.max(ret - ALERT_BEFORE_RETURN_MIN, notify + ALERT_AFTER_NOTIFY_MIN, leave);
  return at < ret && at < 1440 ? at : null;
}

export function alertWindow(u: Times, now: LocalNow): Window {
  const { ret } = spans(u);
  return { start: isoAt(now.date, now.minutes), end: isoAt(now.date, ret) };
}

export function dueActions(u: ReadyUser, now: LocalNow): { report: boolean; alert: boolean } {
  if (u.days[now.weekday] !== "1") return { report: false, alert: false };
  const { notify, ret } = spans(u);

  const report =
    u.last_report_date !== now.date && now.minutes >= notify && now.minutes < notify + REPORT_GRACE_MIN;

  const at = alertMinute(u);
  const alert =
    at !== null &&
    u.last_report_date === now.date && // uyarı, o gün sabah raporu gittiyse
    u.last_alert_date !== now.date &&
    now.minutes >= at &&
    now.minutes < Math.min(at + REPORT_GRACE_MIN, ret);

  return { report, alert };
}
