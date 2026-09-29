import { describe, expect, it } from "vitest";
import { advise, tierFor } from "../src/advice/advice";
import { summarize } from "../src/weather/summarize";
import { makeHours } from "./helpers";

const DAY = "2026-09-30";
const WINDOW = { start: `${DAY}T08:00`, end: `${DAY}T19:00` };

function adviceFor(base: Parameters<typeof makeHours>[1], over: Parameters<typeof makeHours>[2] = {}, sensitivity = 0) {
  const s = summarize(makeHours(DAY, base, over), WINDOW)!;
  return { s, a: advise(s, sensitivity) };
}

describe("tierFor", () => {
  it.each([
    [-5, 5],
    [0, 5],
    [3, 4],
    [7, 4],
    [10, 3],
    [15, 2],
    [20, 1],
    [23, 1],
    [28, 0],
  ])("hissedilen %i° → kademe %i", (feels, tier) => {
    expect(tierFor(feels)).toBe(tier);
  });
});

describe("advise", () => {
  it("sakin 15°: ince ceket, düzeltme yok", () => {
    const { a } = adviceFor({ temp: 15, feels: 15 });
    expect(a.tier).toBe(2);
    expect(a.reasons).toEqual([]);
    expect(a.items).toEqual([]);
  });

  it("15° ama rüzgarlı: kademe +1 ve rüzgar geçirmez", () => {
    const { a } = adviceFor({ temp: 15, feels: 14, wind: 25, gust: 45 });
    expect(a.baseTier).toBe(2);
    expect(a.tier).toBe(3);
    expect(a.windproof).toBe(true);
    expect(a.reasons).toContain("wind_colder");
  });

  it("sıcak ama esintili: tişört yerine ince uzun kollu", () => {
    const { a } = adviceFor({ temp: 27, feels: 26, wind: 22, gust: 38 });
    expect(a.baseTier).toBe(0);
    expect(a.tier).toBe(1);
    expect(a.longSleeves).toBe(true);
    expect(a.reasons).toEqual(["breezy_warm"]);
  });

  it("sıcak ve sakin: tişört", () => {
    const { a } = adviceFor({ temp: 27, feels: 27, wind: 8, gust: 15 });
    expect(a.tier).toBe(0);
    expect(a.longSleeves).toBe(false);
  });

  it("soğuk yağmur: kademe +1, su geçirmez, şemsiye", () => {
    const { a, s } = adviceFor(
      { temp: 10, feels: 9 },
      {
        [`${DAY}T17:00`]: { precipProb: 80, precip: 1.2, code: 61 },
        [`${DAY}T18:00`]: { precipProb: 85, precip: 2.0, code: 63 },
      },
    );
    expect(s.rain).toHaveLength(1);
    expect(s.rain[0]).toMatchObject({ from: "17:00", to: "19:00", prob: 85, mm: 3.2 });
    expect(a.baseTier).toBe(3);
    expect(a.tier).toBe(4);
    expect(a.waterproof).toBe(true);
    expect(a.items).toContain("umbrella");
  });

  it("yağmur + sert hamle: şemsiye yerine yağmurluk", () => {
    const { a } = adviceFor(
      { temp: 14, feels: 12, wind: 30, gust: 55 },
      { [`${DAY}T12:00`]: { precipProb: 70, precip: 1, code: 61 } },
    );
    expect(a.items).toContain("raincoat");
    expect(a.items).not.toContain("umbrella");
  });

  it("rüzgar + soğuk yağmur: en fazla mont kademesine çıkarır", () => {
    const { a } = adviceFor(
      { temp: 9, feels: 6, wind: 30, gust: 45 },
      { [`${DAY}T12:00`]: { precipProb: 70, precip: 1, code: 61 } },
    );
    expect(a.baseTier).toBe(4);
    expect(a.tier).toBe(4);
    expect(a.windproof && a.waterproof).toBe(true);
  });

  it("serin + rüzgar + yağmur: iki kademe artar", () => {
    const { a } = adviceFor(
      { temp: 11, feels: 14, wind: 25, gust: 45 },
      { [`${DAY}T12:00`]: { precipProb: 70, precip: 1, code: 61 } },
    );
    expect(a.baseTier).toBe(2);
    expect(a.tier).toBe(4);
  });

  it("dondurucu soğuk: bere/eldiven kademesi korunur", () => {
    const { a } = adviceFor({ temp: 2, feels: -1, wind: 30, gust: 50 });
    expect(a.tier).toBe(5);
  });

  it("düşük olasılıklı yağmur: küçük şemsiye", () => {
    const { a, s } = adviceFor({}, { [`${DAY}T15:00`]: { precipProb: 40, precip: 0.1 } });
    expect(s.maybeRain).toEqual({ time: "15:00", prob: 40 });
    expect(a.items).toEqual(["small_umbrella"]);
  });

  it("büyük sıcaklık farkı: katmanlı; yüksek UV: güneş kremi", () => {
    const { a } = adviceFor(
      { temp: 12, feels: 12 },
      { [`${DAY}T14:00`]: { temp: 22, feels: 22, uv: 7 } },
    );
    expect(a.items).toEqual(expect.arrayContaining(["layers", "sunscreen"]));
  });

  it("üşüyen kişi bir kademe daha kalın giyer", () => {
    expect(adviceFor({ temp: 16, feels: 16 }, {}, 0).a.tier).toBe(2);
    expect(adviceFor({ temp: 16, feels: 16 }, {}, 1).a.tier).toBe(3);
    expect(adviceFor({ temp: 16, feels: 16 }, {}, -1).a.tier).toBe(1);
  });
});
