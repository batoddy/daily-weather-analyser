// "Tek bakışta" kısmı: uykulu gözle okunacak başlık ve kısa satırlar.
// İlk satır bildirim önizlemesinde görünür; ne giyileceği ve ne alınacağı orada olmalı.

import type { Item, Tier } from "../advice/advice";
import { T } from "../advice/thresholds";
import type { CityEvent, CityKind } from "../weather/city";
import type { RainSpan, SevereEvent, SevereKind, Summary } from "../weather/summarize";
import type { Lang } from "./i18n";

interface GlanceStrings {
  clothing(tier: Tier, longSleeves: boolean): [emoji: string, label: string];
  item: Partial<Record<Item, string>>; // başlıktaki "yanına al" etiketleri
  severe: Record<SevereKind, string>;
  feels: string;
  diff(d: number, tomorrow: boolean): string;
  rain(heavy: boolean, snow: boolean): string;
  maybeRain(time: string, prob: number): string;
  strongWind(time: string): string; // hamle 50-62: sert
  veryStrongWind(time: string): string; // hamle 62-75: çok sert (gün içi uyarı eşiği)
  windyCool: string;
  breezy: string;
  layers(swing: number): string;
  uv(uv: number): string;
  greeting(name: string, hour: number): string;
  tomorrow: string;
  details: string;
  alertFooter: string;
  city(name: string | null, events: string): string;
  cityKind: Record<CityKind, string>;
}

const tr: GlanceStrings = {
  clothing: (tier, longSleeves) =>
    (
      [
        longSleeves ? ["👕", "İNCE UZUN KOLLU"] : ["👕", "TİŞÖRT"],
        longSleeves ? ["👕", "İNCE UZUN KOLLU"] : ["👕", "TİŞÖRT + İNCE BİR ŞEY"],
        ["🧥", "İNCE CEKET"],
        ["🧥", "CEKET"],
        ["🧥", "MONT"],
        ["🧣", "KALIN MONT + BERE"],
      ] as [string, string][]
    )[tier]!,
  item: {
    umbrella: "☔ ŞEMSİYE",
    raincoat: "🌧️ YAĞMURLUK",
    small_umbrella: "🌂 küçük şemsiye",
    sunscreen: "🕶️ GÜNEŞ KREMİ",
    waterproof_shoes: "🥾 BOT",
  },
  severe: {
    thunderstorm: "GÖK GÜRÜLTÜLÜ SAĞANAK",
    hail: "DOLU",
    heavy_snow: "YOĞUN KAR",
    freezing_rain: "BUZLANMA",
    storm_wind: "FIRTINA",
    extreme_heat: "AŞIRI SICAK",
    extreme_cold: "AŞIRI SOĞUK",
  },
  feels: "hissedilen",
  diff: (d, tomorrow) => `${d < 0 ? "📉" : "📈"} ${tomorrow ? "Bugünden" : "Dünden"} <b>${Math.abs(d)}° daha ${d < 0 ? "soğuk" : "sıcak"}</b>`,
  rain: (heavy, snow) => (snow ? (heavy ? "YOĞUN KAR" : "kar") : heavy ? "ŞİDDETLİ YAĞMUR" : "yağmur"),
  maybeRain: (time, prob) => `🌦️ ${time} civarı belki yağmur (%${prob})`,
  strongWind: (time) => `💨 Sert rüzgar (${time} civarı): şemsiye ters dönebilir`,
  veryStrongWind: (time) => `💨 <b>Çok sert rüzgar</b> (${time} civarı): yürümek zorlaşır, şemsiye işe yaramaz`,
  windyCool: "💨 Rüzgarlı, olduğundan soğuk hissettirir",
  breezy: "💨 Esintili",
  layers: (swing) => `🧅 Katmanlı giyin, gün içinde ${swing}° fark var`,
  uv: (uv) => `🕶️ Güneş güçlü (UV ${uv})`,
  greeting: (name, hour) => `${hour < 12 ? "☀️" : "👋"} <i>${hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar"} ${name}!</i>`,
  tomorrow: "🌙 <i>Yarın için</i>",
  details: "Detaylar",
  alertFooter: "Dönüşten önce hatırlatma",
  city: (name, events) => `🏙️ <i>${name ? `${name} çevresinde` : "Şehrin bazı yerlerinde"} yer yer ${events}</i>`,
  cityKind: {
    heavy_rain: "şiddetli yağmur",
    thunderstorm: "gök gürültülü sağanak",
    hail: "dolu",
    heavy_snow: "yoğun kar",
    freezing_rain: "buzlanma",
  },
};

const en: GlanceStrings = {
  clothing: (tier, longSleeves) =>
    (
      [
        longSleeves ? ["👕", "THIN LONG SLEEVES"] : ["👕", "T-SHIRT"],
        longSleeves ? ["👕", "THIN LONG SLEEVES"] : ["👕", "T-SHIRT + LIGHT LAYER"],
        ["🧥", "LIGHT JACKET"],
        ["🧥", "JACKET"],
        ["🧥", "COAT"],
        ["🧣", "HEAVY COAT + HAT"],
      ] as [string, string][]
    )[tier]!,
  item: {
    umbrella: "☔ UMBRELLA",
    raincoat: "🌧️ RAIN JACKET",
    small_umbrella: "🌂 small umbrella",
    sunscreen: "🕶️ SUNSCREEN",
    waterproof_shoes: "🥾 BOOTS",
  },
  severe: {
    thunderstorm: "THUNDERSTORM",
    hail: "HAIL",
    heavy_snow: "HEAVY SNOW",
    freezing_rain: "ICY ROADS",
    storm_wind: "STORM",
    extreme_heat: "EXTREME HEAT",
    extreme_cold: "EXTREME COLD",
  },
  feels: "feels",
  diff: (d, tomorrow) => `${d < 0 ? "📉" : "📈"} <b>${Math.abs(d)}° ${d < 0 ? "colder" : "warmer"}</b> than ${tomorrow ? "today" : "yesterday"}`,
  rain: (heavy, snow) => (snow ? (heavy ? "HEAVY SNOW" : "snow") : heavy ? "HEAVY RAIN" : "rain"),
  maybeRain: (time, prob) => `🌦️ Maybe rain around ${time} (${prob}%)`,
  strongWind: (time) => `💨 Strong wind (around ${time}): umbrellas may flip`,
  veryStrongWind: (time) => `💨 <b>Very strong wind</b> (around ${time}): hard to walk, umbrella useless`,
  windyCool: "💨 Windy, feels colder than it is",
  breezy: "💨 Breezy",
  layers: (swing) => `🧅 Dress in layers, ${swing}° swing during the day`,
  uv: (uv) => `🕶️ Strong sun (UV ${uv})`,
  greeting: (name, hour) => `${hour < 12 ? "☀️" : "👋"} <i>${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"} ${name}!</i>`,
  tomorrow: "🌙 <i>For tomorrow</i>",
  details: "Details",
  alertFooter: "Heads-up before you head home",
  city: (name, events) => `🏙️ <i>${name ? `Around ${name}` : "Elsewhere in the city"}, locally: ${events}</i>`,
  cityKind: {
    heavy_rain: "heavy rain",
    thunderstorm: "thunderstorms",
    hail: "hail",
    heavy_snow: "heavy snow",
    freezing_rain: "icy roads",
  },
};

export const GLANCE: Record<Lang, GlanceStrings> = { tr, en };

/** Bildirimde görünen kısım: varsa aşırı olay, sonra "ne giy · ne al". */
export function headline(
  lang: Lang,
  a: { tier: Tier; longSleeves: boolean; items: Item[] },
  severe: SevereEvent[],
): string[] {
  const g = GLANCE[lang];
  const [emoji, label] = g.clothing(a.tier, a.longSleeves);
  const chips = [`${emoji} <b>${label}</b>`, ...a.items.flatMap((i) => (g.item[i] ? [boldChip(g.item[i])] : []))];
  return [...severeLines(lang, severe), chips.join("  ·  ")];
}

export function severeLines(lang: Lang, severe: SevereEvent[]): string[] {
  const g = GLANCE[lang];
  return severe.map((e) => `⚠️ <b>${g.severe[e.kind]} ${e.from}–${e.to}</b>`);
}

export function rainGlance(lang: Lang, rain: RainSpan[]): string[] {
  const g = GLANCE[lang];
  return rain.map((r) => `${r.snow ? "🌨️" : "☔"} <b>${r.from}–${r.to} ${g.rain(r.heavy, r.snow)}</b>`);
}

export function windGlance(lang: Lang, w: { cool: boolean; windy: boolean; gustMax: number; gustTime: string }): string | null {
  const g = GLANCE[lang];
  if (w.gustMax >= T.stormGust) return null; // "FIRTINA" aşırı olay olarak zaten en üstte
  if (w.gustMax >= T.alertGust) return g.veryStrongWind(w.gustTime);
  if (w.gustMax >= T.gustNoUmbrella) return g.strongWind(w.gustTime);
  if (!w.windy) return null;
  return w.cool ? g.windyCool : g.breezy;
}

/** Şehir geneli notu; kişinin kendi konumlarında zaten söylenen olaylar tekrar edilmez. */
export function cityGlance(lang: Lang, cityName: string | null, events: CityEvent[], sm: Summary): string | null {
  const g = GLANCE[lang];
  const personal = new Set<string>(sm.severe.map((e) => e.kind));
  if (sm.rain.some((r) => r.heavy)) personal.add("heavy_rain");
  const fresh = events.filter((e) => !personal.has(e.kind));
  if (fresh.length === 0) return null;
  return g.city(cityName, fresh.map((e) => `${e.from}–${e.to} ${g.cityKind[e.kind]}`).join(", "));
}

// "🌂 küçük şemsiye" gibi zayıf öneriler kalın yazılmaz
function boldChip(chip: string): string {
  const [emoji, ...rest] = chip.split(" ");
  const text = rest.join(" ");
  return text === text.toLocaleUpperCase("tr-TR") ? `${emoji} <b>${text}</b>` : chip;
}
