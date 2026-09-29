// Kullanıcıya giden tüm sabit metinler (tr / en).

import type { Item, Reason, Tier } from "../advice/advice";
import type { SevereKind, Sky } from "../weather/summarize";

export type Lang = "tr" | "en";

export function asLang(v: string | null | undefined): Lang {
  return v === "en" ? "en" : "tr";
}

export const SKY_EMOJI: Record<Sky, string> = {
  clear: "☀️",
  partly: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  snow: "🌨️",
  storm: "⛈️",
};

interface Strings {
  weekdays: string[]; // Pazartesi'den başlar
  months: string[];
  greeting(hour: number): string;
  tomorrow: string;
  now: string;
  leave: string;
  peak: string;
  coldest: string;
  back: string;
  feels: string;
  vsYesterday(diff: number, tomorrow: boolean): string;
  wind(mean: number, gust: number, time: string): string;
  rain(from: string, to: string, prob: number, mm: string, heavy: boolean, snow: boolean): string;
  maybeRain(time: string, prob: number): string;
  uv(uv: number, time: string): string;
  severe(kind: SevereKind, value: number): string;
  clothing(tier: Tier, opts: { windproof: boolean; waterproof: boolean; longSleeves: boolean }): string;
  reason(r: Reason, maxTemp: number): string;
  item(i: Item, ctx: { rainSpans: string; swing: number }): string;
  severeAdvice: string;
  alertTitle: string;
  alertUmbrella: string;
  alertRaincoat: string;
  alertCareful: string;
  // Doğrulama: LLM çıktısında geçmesi gereken anahtar kelimeler (herhangi biri yeterli)
  kwTier: Record<Tier, string[]>;
  kwReason: Record<Reason, string[]>;
  kwItem: Record<Item, string[]>;
  kwSevere: Record<SevereKind, string[]>;
  kwWindproof: string[];
}

const tr: Strings = {
  weekdays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"],
  months: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  greeting: (h) => (h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar"),
  tomorrow: "Yarın",
  now: "Şimdi",
  leave: "Çıkış",
  peak: "En sıcak",
  coldest: "En soğuk",
  back: "Dönüş",
  feels: "hissedilen",
  vsYesterday: (d, tomorrow) => {
    const ref = tomorrow ? "Bugünden" : "Dünden";
    if (d === 0 || Math.abs(d) < 3) return `📊 ${tomorrow ? "Bugünle" : "Dünle"} benzer sıcaklıkta`;
    return `📊 ${ref} ${Math.abs(d)}° daha ${d < 0 ? "soğuk" : "sıcak"}`;
  },
  wind: (mean, gust, time) => `💨 Rüzgar ${mean} km/s, hamleler ${gust} km/s'ye kadar (${time} civarı)`,
  rain: (from, to, prob, mm, heavy, snow) =>
    `${heavy ? "⚠️ " : ""}${snow ? "🌨️" : "☔"} ${from}–${to} ${heavy ? "şiddetli " : ""}${snow ? "kar" : "yağmur"} (%${prob}, ${mm} mm)`,
  maybeRain: (time, prob) => `🌦️ ${time} civarı %${prob} ihtimalle yağmur`,
  uv: (uv, time) => `🧴 UV ${uv} (${time} civarı)`,
  severe: (kind, v) =>
    ({
      thunderstorm: "gök gürültülü sağanak",
      hail: "dolu",
      heavy_snow: "yoğun kar",
      freezing_rain: "dondurucu yağmur, buzlanma",
      storm_wind: `fırtına, hamleler ${v} km/s`,
      extreme_heat: `aşırı sıcak, hissedilen ${v}°`,
      extreme_cold: `aşırı soğuk, hissedilen ${v}°`,
    })[kind],
  clothing: (tier, o) => {
    switch (tier) {
      case 5:
        return "Kalın mont, bere ve eldiven şart.";
      case 4:
        return o.windproof && o.waterproof
          ? "Rüzgar ve su geçirmeyen bir mont giy."
          : o.windproof
            ? "Rüzgar geçirmeyen bir mont giy."
            : o.waterproof
              ? "Su geçirmez bir mont giy."
              : "Mont giy.";
      case 3:
        return o.windproof && o.waterproof
          ? "Rüzgar ve su geçirmeyen bir ceket al."
          : o.windproof
            ? "Rüzgar geçirmeyen bir ceket al."
          : o.waterproof
            ? "Su geçirmez bir ceket al."
            : "Ceket ya da kalın bir hırka al.";
      case 2:
        return o.windproof
          ? "İnce ama rüzgar geçirmeyen bir ceket al."
          : o.waterproof
            ? "İnce bir yağmurluk ya da ceket al."
            : "İnce bir ceket ya da sweatshirt yeterli.";
      case 1:
        return o.longSleeves
          ? "İnce uzun kollu bir şey giy ya da tişörtün üstüne ince bir şey al."
          : "Tişört yeter ama yanına ince bir şey al.";
      case 0:
        return "Tişört havası.";
    }
  },
  reason: (r, maxTemp) =>
    ({
      wind_colder: "Rüzgar yüzünden olduğundan soğuk hissettirecek.",
      wet_cold: "Yağmurla birlikte ıslak ve soğuk olacak.",
      breezy_warm: maxTemp >= 26 ? "Hava sıcak ama esintili." : "Hava ılık ama esintili.",
    })[r],
  item: (i, c) =>
    ({
      umbrella: `${c.rainSpans} arası yağmur var, şemsiyeni al.`,
      raincoat: `${c.rainSpans} arası yağmur var ama rüzgar şemsiyeyi zorlar, yağmurluk ya da kapüşonlu bir şey al.`,
      small_umbrella: "Yağmur ihtimali düşük ama çantaya küçük bir şemsiye atabilirsin.",
      layers: `Gün içinde ${c.swing}° fark var, katmanlı giyin.`,
      sunscreen: "Güneş güçlü, güneş kremi ve gözlük iyi olur.",
      waterproof_shoes: "Kar var, su geçirmez ayakkabı giy.",
    })[i],
  severeAdvice: "Aşırı hava olayına dikkat et, mümkünse dışarıda fazla kalma.",
  alertTitle: "⚠️ Günün geri kalanı için uyarı",
  alertUmbrella: "Şemsiyeni unutma.",
  alertRaincoat: "Rüzgar sert, şemsiye yerine yağmurluk ya da kapüşon daha iyi.",
  alertCareful: "Dışarıdaysan dikkatli ol.",
  kwTier: {
    5: ["mont", "kaban", "bere", "eldiven"],
    4: ["mont", "kaban"],
    3: ["ceket", "hırka", "mont"],
    2: ["ceket", "sweatshirt", "hırka", "yağmurluk"],
    1: ["uzun kollu", "ince", "tişört"],
    0: ["tişört", "ince", "hafif"],
  },
  kwReason: {
    wind_colder: ["rüzgar"],
    wet_cold: ["yağmur", "ıslak", "su geçirmez"],
    breezy_warm: ["esinti", "rüzgar", "uzun kollu"],
  },
  kwItem: {
    umbrella: ["şemsiye"],
    raincoat: ["yağmurluk", "kapüşon"],
    small_umbrella: ["şemsiye"],
    layers: ["katman"],
    sunscreen: ["güneş", "krem"],
    waterproof_shoes: ["ayakkabı", "bot"],
  },
  kwSevere: {
    thunderstorm: ["fırtına", "gök gürültü", "sağanak"],
    hail: ["dolu"],
    heavy_snow: ["kar"],
    freezing_rain: ["buz", "dondurucu"],
    storm_wind: ["fırtına", "rüzgar"],
    extreme_heat: ["sıcak"],
    extreme_cold: ["soğuk"],
  },
  kwWindproof: ["rüzgar"],
};

const en: Strings = {
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  greeting: (h) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"),
  tomorrow: "Tomorrow",
  now: "Now",
  leave: "Leaving",
  peak: "Warmest",
  coldest: "Coldest",
  back: "Back",
  feels: "feels like",
  vsYesterday: (d, tomorrow) => {
    const ref = tomorrow ? "today" : "yesterday";
    if (d === 0 || Math.abs(d) < 3) return `📊 About the same as ${ref}`;
    return `📊 ${Math.abs(d)}° ${d < 0 ? "colder" : "warmer"} than ${ref}`;
  },
  wind: (mean, gust, time) => `💨 Wind ${mean} km/h, gusts up to ${gust} km/h (around ${time})`,
  rain: (from, to, prob, mm, heavy, snow) =>
    `${heavy ? "⚠️ " : ""}${snow ? "🌨️" : "☔"} ${from}–${to} ${heavy ? "heavy " : ""}${snow ? "snow" : "rain"} (${prob}%, ${mm} mm)`,
  maybeRain: (time, prob) => `🌦️ ${prob}% chance of rain around ${time}`,
  uv: (uv, time) => `🧴 UV ${uv} (around ${time})`,
  severe: (kind, v) =>
    ({
      thunderstorm: "thunderstorm",
      hail: "hail",
      heavy_snow: "heavy snow",
      freezing_rain: "freezing rain, icy roads",
      storm_wind: `storm, gusts ${v} km/h`,
      extreme_heat: `extreme heat, feels like ${v}°`,
      extreme_cold: `extreme cold, feels like ${v}°`,
    })[kind],
  clothing: (tier, o) => {
    switch (tier) {
      case 5:
        return "Heavy coat, hat and gloves.";
      case 4:
        return o.windproof && o.waterproof
          ? "Wear a wind- and waterproof coat."
          : o.windproof
            ? "Wear a windproof coat."
            : o.waterproof
              ? "Wear a waterproof coat."
              : "Wear a coat.";
      case 3:
        return o.windproof && o.waterproof
          ? "Take a wind- and waterproof jacket."
          : o.windproof
            ? "Take a windproof jacket."
          : o.waterproof
            ? "Take a waterproof jacket."
            : "Take a jacket or a thick cardigan.";
      case 2:
        return o.windproof
          ? "A light but windproof jacket."
          : o.waterproof
            ? "A light rain jacket."
            : "A light jacket or sweatshirt is enough.";
      case 1:
        return o.longSleeves
          ? "Wear something light with long sleeves, or bring a thin layer over your t-shirt."
          : "T-shirt is fine, but bring a light layer.";
      case 0:
        return "T-shirt weather.";
    }
  },
  reason: (r, maxTemp) =>
    ({
      wind_colder: "The wind will make it feel colder than it is.",
      wet_cold: "With the rain it will feel wet and cold.",
      breezy_warm: maxTemp >= 26 ? "It's hot but breezy." : "It's mild but breezy.",
    })[r],
  item: (i, c) =>
    ({
      umbrella: `Rain ${c.rainSpans}, take an umbrella.`,
      raincoat: `Rain ${c.rainSpans} but the wind is too strong for an umbrella, take a rain jacket or hood.`,
      small_umbrella: "Rain is unlikely, but a small umbrella in your bag won't hurt.",
      layers: `There's a ${c.swing}° swing during the day, dress in layers.`,
      sunscreen: "Strong sun, sunscreen and sunglasses are a good idea.",
      waterproof_shoes: "Snow expected, wear waterproof shoes.",
    })[i],
  severeAdvice: "Watch out for severe weather, avoid staying outside if you can.",
  alertTitle: "⚠️ Heads-up for the rest of the day",
  alertUmbrella: "Don't forget your umbrella.",
  alertRaincoat: "It's too windy for an umbrella, a rain jacket or hood is better.",
  alertCareful: "Be careful if you're outside.",
  kwTier: {
    5: ["coat", "hat", "gloves"],
    4: ["coat"],
    3: ["jacket", "cardigan", "coat"],
    2: ["jacket", "sweatshirt", "hoodie"],
    1: ["long sleeve", "long-sleeve", "layer", "t-shirt"],
    0: ["t-shirt", "light"],
  },
  kwReason: {
    wind_colder: ["wind"],
    wet_cold: ["rain", "wet", "waterproof"],
    breezy_warm: ["breez", "wind", "long sleeve", "long-sleeve"],
  },
  kwItem: {
    umbrella: ["umbrella"],
    raincoat: ["rain jacket", "raincoat", "hood"],
    small_umbrella: ["umbrella"],
    layers: ["layer"],
    sunscreen: ["sunscreen", "sun"],
    waterproof_shoes: ["shoes", "boots"],
  },
  kwSevere: {
    thunderstorm: ["thunder", "storm"],
    hail: ["hail"],
    heavy_snow: ["snow"],
    freezing_rain: ["ice", "icy", "freezing"],
    storm_wind: ["storm", "wind", "gust"],
    extreme_heat: ["heat", "hot"],
    extreme_cold: ["cold"],
  },
  kwWindproof: ["wind"],
};

export const STRINGS: Record<Lang, Strings> = { tr, en };
