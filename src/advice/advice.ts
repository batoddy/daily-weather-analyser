// Kural motoru: özetten giyim kararını verir. LLM bu kararı değiştiremez, sadece anlatır.

import type { Summary } from "../weather/summarize";
import { T } from "./thresholds";

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

export type Item =
  | "umbrella" // yağmur var
  | "raincoat" // yağmur + sert rüzgar → şemsiye işe yaramaz
  | "small_umbrella" // belki yağar
  | "layers" // gün içi sıcaklık farkı büyük
  | "sunscreen"
  | "waterproof_shoes"; // kar

export type Reason =
  | "wind_colder" // serin + rüzgar → kademe +1
  | "wet_cold" // soğuk + yağmur → kademe +1
  | "breezy_warm"; // sıcak ama esintili → ince uzun kollu

export interface Advice {
  baseTier: Tier; // sadece hissedilen sıcaklığa göre
  tier: Tier; // rüzgar/yağmur düzeltmesi sonrası
  windproof: boolean;
  waterproof: boolean;
  longSleeves: boolean;
  items: Item[];
  reasons: Reason[];
}

export function tierFor(feels: number): Tier {
  for (const { maxFeels, tier } of T.tiers) if (feels <= maxFeels) return tier as Tier;
  return 0;
}

/** sensitivity: 1 = çabuk üşür, 0 = normal, -1 = sıcaklar */
export function advise(s: Summary, sensitivity: number): Advice {
  const baseTier = tierFor(s.minFeels - sensitivity * T.sensitivityShift);
  let raise = 0;
  const items: Item[] = [];
  const reasons: Reason[] = [];
  let windproof = false;
  let waterproof = false;
  let longSleeves = false;

  // Rüzgar
  const cool = s.minTemp < T.coolTemp;
  const windy = s.windMax >= T.windMean || s.gustMax >= (cool ? T.gustCool : T.gustWarm);
  if (windy && cool) {
    raise++;
    windproof = true;
    reasons.push("wind_colder");
  } else if (windy) {
    longSleeves = true;
    reasons.push("breezy_warm");
  }

  // Yağış
  if (s.rain.length > 0) {
    items.push(s.gustMax >= T.gustNoUmbrella ? "raincoat" : "umbrella");
    if (Math.min(...s.rain.map((r) => r.minTemp)) < T.coldRainTemp) {
      raise++;
      waterproof = true;
      reasons.push("wet_cold");
    }
    if (s.rain.some((r) => r.snow)) items.push("waterproof_shoes");
  } else if (s.maybeRain) {
    items.push("small_umbrella");
  }

  if (s.maxTemp - s.minTemp >= T.swing) items.push("layers");
  if (s.uvMax >= T.uv) items.push("sunscreen");

  let tier = Math.max(baseTier, Math.min(T.maxRaisedTier, baseTier + Math.min(raise, T.maxTierRaise)));
  if (longSleeves && tier === 0) tier = 1; // sıcak ama esintili: çıplak tişört değil

  return { baseTier, tier: tier as Tier, windproof, waterproof, longSleeves, items, reasons };
}
