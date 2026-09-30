import { describe, expect, it } from "vitest";
import { cityEvents, cityGrid } from "../src/weather/city";
import { combineHomeWork } from "../src/weather/combine";
import { summarize } from "../src/weather/summarize";
import { makeHours } from "./helpers";

const DAY = "2026-09-30";
const at = (h: string) => `${DAY}T${h}:00`;

describe("combineHomeWork", () => {
  const home = makeHours(DAY, { temp: 15, feels: 15 }, { [at("19")]: { temp: 12, feels: 10 } });
  const work = makeHours(DAY, { temp: 20, feels: 20 }, {
    [at("14")]: { precipProb: 80, precip: 2, code: 63 },
    [at("19")]: { temp: 14, feels: 13, gust: 60 },
  });
  const c = combineHomeWork(home, work, "08:15", "19:00");
  const get = (h: string) => c.find((x) => x.time === at(h))!;

  it("çıkışta ev, gün içinde iş, gece ev", () => {
    expect(get("08").temp).toBe(15);
    expect(get("12").temp).toBe(20);
    expect(get("14").precip).toBe(2); // iş yerindeki yağmur
    expect(get("22").temp).toBe(15);
  });

  it("dönüş saatinde ikisinin kötüsü", () => {
    expect(get("19")).toMatchObject({ temp: 12, feels: 10, gust: 60 });
  });

  it("iş yoksa ev serisi aynen döner", () => {
    expect(combineHomeWork(home, null, "08:15", "19:00")).toBe(home);
  });

  it("gece vardiyası: gece yarısını geçen iş saatleri", () => {
    const n = combineHomeWork(home, work, "20:00", "04:00");
    expect(n.find((x) => x.time === at("23"))!.temp).toBe(20);
    expect(n.find((x) => x.time === at("02"))!.temp).toBe(20);
    expect(n.find((x) => x.time === at("12"))!.temp).toBe(15);
  });

  it("iş yerindeki yağmur rapora girer, evdeki girmez", () => {
    const s = summarize(c, { start: `${DAY}T08:15`, end: `${DAY}T19:00` })!;
    expect(s.rain).toHaveLength(1);
    expect(s.rain[0]).toMatchObject({ from: "14:00", to: "15:00" });
  });
});

describe("şehir geneli", () => {
  it("ızgara merkez hariç 8 nokta", () => {
    const g = cityGrid({ lat: 41.05, lon: 28.95 });
    expect(g).toHaveLength(8);
    expect(g).not.toContainEqual({ lat: 41.05, lon: 28.95 });
  });

  const window = { start: `${DAY}T06:00`, end: `${DAY}T23:00` };
  const calm = makeHours(DAY, {});
  const heavy = makeHours(DAY, {}, {
    [at("15")]: { precipProb: 90, precip: 12, code: 65 },
    [at("16")]: { precipProb: 90, precip: 9, code: 65 },
  });

  it("en az 2 noktada şiddetli yağmur varsa olay sayılır", () => {
    const events = cityEvents([heavy, heavy, calm, calm, calm, calm, calm, calm], window);
    expect(events).toEqual([{ kind: "heavy_rain", from: "15:00", to: "17:00" }]);
  });

  it("tek noktadaki şiddetli yağmur gürültü sayılır", () => {
    expect(cityEvents([heavy, calm, calm, calm, calm, calm, calm, calm], window)).toEqual([]);
  });
});
