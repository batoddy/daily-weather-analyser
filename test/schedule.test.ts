import { describe, expect, it } from "vitest";
import type { ReadyUser } from "../src/db/users";
import { alertMinute, dueActions, reportWindow } from "../src/schedule";
import { localNow, parseTime, type LocalNow } from "../src/time";

const user: ReadyUser = {
  chat_id: 1,
  name: "Test",
  lang: "tr",
  lat: 41,
  lon: 29,
  timezone: "Europe/Istanbul",
  place_label: null,
  notify_time: "07:30",
  leave_time: "08:15",
  return_time: "19:00",
  days: "1111100",
  sensitivity: 0,
  status: "active",
  step: null,
  pending_places: null,
  last_report_date: null,
  last_alert_date: null,
  created_at: "",
};

// 2026-09-30 Çarşamba
const at = (time: string, weekday = 2): LocalNow => {
  const [h, m] = time.split(":").map(Number);
  return { date: "2026-09-30", time, minutes: h! * 60 + m!, weekday };
};

describe("dueActions", () => {
  it("mesaj saatinden önce göndermez, sonra 2 saat içinde gönderir", () => {
    expect(dueActions(user, at("07:15")).report).toBe(false);
    expect(dueActions(user, at("07:30")).report).toBe(true);
    expect(dueActions(user, at("09:15")).report).toBe(true);
    expect(dueActions(user, at("09:30")).report).toBe(false);
  });

  it("aynı gün ikinci kez göndermez", () => {
    expect(dueActions({ ...user, last_report_date: "2026-09-30" }, at("07:45")).report).toBe(false);
  });

  it("seçili olmayan günlerde göndermez", () => {
    expect(dueActions(user, at("07:45", 5)).report).toBe(false); // Cumartesi
  });

  it("uyarı dönüşten 2 saat önce, sabah raporu gittiyse kontrol edilir", () => {
    const sent = { ...user, last_report_date: "2026-09-30" };
    expect(alertMinute(user)).toBe(17 * 60);
    expect(dueActions(sent, at("16:45")).alert).toBe(false);
    expect(dueActions(sent, at("17:00")).alert).toBe(true);
    expect(dueActions(user, at("17:00")).alert).toBe(false); // rapor gitmemiş
    expect(dueActions({ ...sent, last_alert_date: "2026-09-30" }, at("17:15")).alert).toBe(false);
  });

  it("kısa günlerde uyarı sabah mesajından en az 2 saat sonra", () => {
    expect(alertMinute({ ...user, return_time: "10:30" })).toBe(9 * 60 + 30);
    expect(alertMinute({ ...user, return_time: "09:00" })).toBeNull();
  });
});

describe("reportWindow", () => {
  it("çıkıştan önce: çıkış → dönüş", () => {
    expect(reportWindow(user, at("07:30"))).toEqual({ start: "2026-09-30T08:15", end: "2026-09-30T19:00" });
  });
  it("çıkıştan sonra: şimdi → dönüş", () => {
    expect(reportWindow(user, at("13:47"))).toMatchObject({ start: "2026-09-30T13:47", startsNow: true });
  });
  it("dönüşten sonra: yarının penceresi", () => {
    expect(reportWindow(user, at("21:00"))).toEqual({
      start: "2026-10-01T08:15",
      end: "2026-10-01T19:00",
      tomorrow: true,
    });
  });
  it("gece yarısını geçen dönüş", () => {
    expect(reportWindow({ ...user, leave_time: "20:00", return_time: "02:00" }, at("18:00")).end).toBe(
      "2026-10-01T02:00",
    );
  });
});

describe("time", () => {
  it.each([
    ["7", "07:00"],
    ["7:30", "07:30"],
    ["07.45", "07:45"],
    ["0730", "07:30"],
    ["730", "07:30"],
    ["7 30", "07:30"],
    ["24:00", null],
    ["abc", null],
  ])("parseTime(%s) → %s", (input, out) => {
    expect(parseTime(input)).toBe(out);
  });

  it("localNow saat dilimine göre çalışır", () => {
    const now = localNow("Europe/Istanbul", new Date("2026-09-30T04:30:00Z"));
    expect(now).toEqual({ date: "2026-09-30", time: "07:30", minutes: 450, weekday: 2 });
    // Riga kışın UTC+2
    expect(localNow("Europe/Riga", new Date("2026-12-01T05:30:00Z")).time).toBe("07:30");
  });
});
