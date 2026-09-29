import { describe, expect, it } from "vitest";
import { severeEvents, summarize } from "../src/weather/summarize";
import { makeHours } from "./helpers";

const DAY = "2026-09-30";

describe("summarize", () => {
  it("çıkış, en sıcak ve dönüş noktalarını seçer", () => {
    const hours = makeHours(DAY, { temp: 10, feels: 8 }, { [`${DAY}T14:00`]: { temp: 16, feels: 15 } });
    const s = summarize(hours, { start: `${DAY}T08:15`, end: `${DAY}T19:00` })!;
    expect(s.leave).toEqual({ time: "08:15", temp: 10, feels: 8 });
    expect(s.peak).toEqual({ time: "14:00", temp: 16, feels: 15 });
    expect(s.back.time).toBe("19:00");
    expect(s.minFeels).toBe(8);
  });

  it("dünle farkı hesaplar", () => {
    const hours = makeHours(DAY, { temp: 10 }, {}, { temp: 15 });
    const s = summarize(hours, { start: `${DAY}T08:00`, end: `${DAY}T19:00` })!;
    expect(s.yesterdayDiff).toBe(-5);
  });

  it("aşırı olayları pencere bitse de gün sonuna kadar tarar", () => {
    const hours = makeHours(DAY, {}, { [`${DAY}T21:00`]: { code: 95, gust: 60 } });
    const s = summarize(hours, { start: `${DAY}T08:00`, end: `${DAY}T18:00` })!;
    expect(s.severe).toEqual([{ kind: "thunderstorm", from: "21:00", to: "22:00", value: 60 }]);
  });

  it("şiddetli yağmuru işaretler", () => {
    const hours = makeHours(DAY, {}, { [`${DAY}T16:00`]: { precipProb: 90, precip: 9, code: 65 } });
    const s = summarize(hours, { start: `${DAY}T08:00`, end: `${DAY}T19:00` })!;
    expect(s.rain[0]).toMatchObject({ heavy: true, from: "16:00", to: "17:00" });
    expect(s.sky).toBe("rain");
  });

  it("pencerede veri yoksa null", () => {
    expect(summarize([], { start: `${DAY}T08:00`, end: `${DAY}T19:00` })).toBeNull();
  });
});

describe("severeEvents", () => {
  it("fırtına rüzgarı, aşırı sıcak ve aşırı soğuğu ardışık aralıklara gruplar", () => {
    const hours = makeHours(DAY, {}, {
      [`${DAY}T10:00`]: { gust: 80 },
      [`${DAY}T11:00`]: { gust: 90 },
      [`${DAY}T15:00`]: { feels: 40 },
      [`${DAY}T20:00`]: { feels: -18 },
    }).filter((h) => h.time.startsWith(DAY));
    expect(severeEvents(hours)).toEqual([
      { kind: "storm_wind", from: "10:00", to: "12:00", value: 90 },
      { kind: "extreme_heat", from: "15:00", to: "16:00", value: 40 },
      { kind: "extreme_cold", from: "20:00", to: "21:00", value: -18 },
    ]);
  });
});
