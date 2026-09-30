import { describe, expect, it } from "vitest";
import { advise } from "../src/advice/advice";
import { composeAlert, composeReport, llmFacts, mustMention, templateComment, type ReportInput } from "../src/message/report";
import { numbersIn, validateComment } from "../src/message/validate";
import { summarize } from "../src/weather/summarize";
import { makeHours } from "./helpers";

const DAY = "2026-09-30";

function input(lang: "tr" | "en" = "tr"): ReportInput {
  const hours = makeHours(
    DAY,
    { temp: 14, feels: 12, wind: 25, gust: 45 },
    {
      [`${DAY}T17:00`]: { precipProb: 80, precip: 1.2, code: 61, temp: 10, feels: 7 },
      [`${DAY}T18:00`]: { precipProb: 75, precip: 0.9, code: 61, temp: 9, feels: 6 },
    },
    { temp: 18, feels: 18 },
  );
  const window = { start: `${DAY}T08:15`, end: `${DAY}T19:00` };
  const summary = summarize(hours, window)!;
  return {
    name: "Batuhan",
    place: "Kadıköy, İstanbul",
    lang,
    now: { date: DAY, time: "07:30", minutes: 450, weekday: 2 },
    window,
    summary,
    advice: advise(summary, 0),
  };
}

describe("rapor", () => {
  it("türkçe rapor: gerçek + hissedilen, dünle fark, rüzgar, yağmur", () => {
    const inp = input();
    const text = composeReport(inp, templateComment(inp));
    expect(text).toContain("Günaydın Batuhan");
    expect(text).toContain("Çarşamba, 30 Eylül");
    expect(text).toContain("🚪 Çıkış 08:15: <b>14°</b>, hissedilen 12°");
    expect(text).toContain("🥶 En soğuk 18:00: <b>9°</b>, hissedilen 6°");
    expect(text).toContain("Dünden 5° daha soğuk");
    expect(text).toContain("💨 Rüzgar 25 km/s");
    expect(text).toContain("☔ 17:00–19:00 yağmur (%80, 2,1 mm)");
    expect(text).toContain("şemsiye");
    console.log(`\n${text}\n`);
  });

  it("ilk satır (bildirim önizlemesi) ne giyileceğini ve şemsiyeyi söyler", () => {
    const inp = input();
    const firstLine = composeReport(inp, templateComment(inp)).split("\n")[0];
    expect(firstLine).toBe("🧥 <b>MONT</b>  ·  ☔ <b>ŞEMSİYE</b>");
  });

  it("tek bakışta: sıcaklık seyri, dünle fark, yağmur, rüzgar; detaylar açılır blokta", () => {
    const inp = input();
    const text = composeReport(inp, templateComment(inp));
    expect(text).toContain("🌡️ <b>14° ➜ 9° ➜ 14°</b>  (hissedilen 6°–12°)");
    expect(text).toContain("📉 Dünden <b>5° daha soğuk</b>");
    expect(text).toContain("☔ <b>17:00–19:00 yağmur</b>");
    expect(text).toContain("💨 Rüzgarlı, olduğundan soğuk hissettirir");
    expect(text).toMatch(/<blockquote expandable>[\s\S]*🥶 En soğuk 18:00[\s\S]*<\/blockquote>$/);
  });

  it("aşırı olay varsa en üstte", () => {
    const inp = input();
    inp.summary = { ...inp.summary, severe: [{ kind: "thunderstorm", from: "16:00", to: "18:00", value: 60 }] };
    const lines = composeReport(inp, templateComment(inp)).split("\n");
    expect(lines[0]).toBe("⚠️ <b>GÖK GÜRÜLTÜLÜ SAĞANAK 16:00–18:00</b>");
    expect(lines[1]).toContain("MONT");
  });

  it("şehir geneli: kişisel konumlarda olmayan yoğun yağış ufak notla söylenir", () => {
    const inp = { ...input(), city: { name: "İstanbul", events: [{ kind: "heavy_rain" as const, from: "15:00", to: "17:00" }] } };
    expect(composeReport(inp, templateComment(inp))).toContain(
      "🏙️ <i>İstanbul çevresinde yer yer 15:00–17:00 şiddetli yağmur</i>",
    );
  });

  it("şehir geneli: kişinin kendi konumunda zaten varsa tekrar edilmez", () => {
    const base = input();
    const inp = {
      ...base,
      summary: { ...base.summary, severe: [{ kind: "thunderstorm" as const, from: "16:00", to: "17:00", value: 50 }] },
      city: { name: "İstanbul", events: [{ kind: "thunderstorm" as const, from: "16:00", to: "18:00" }] },
    };
    expect(composeReport(inp, templateComment(inp))).not.toContain("🏙️");
  });

  it("detaylarda ev ve iş", () => {
    const inp = { ...input(), work: "Maslak, İstanbul" };
    expect(composeReport(inp, templateComment(inp))).toContain("🏠 Kadıköy, İstanbul · 🏢 Maslak, İstanbul");
  });

  it("şablon yorum kendi doğrulamasından geçer (tr + en)", () => {
    for (const lang of ["tr", "en"] as const) {
      const inp = input(lang);
      const v = validateComment(templateComment(inp), llmFacts(inp), mustMention(inp), lang);
      expect(v.problems).toEqual([]);
    }
  });
});

describe("LLM doğrulama", () => {
  it("uydurulmuş sayıyı ve eksik konuyu yakalar", () => {
    const inp = input();
    const v = validateComment("Bugün 22 derece, tişört yeter.", llmFacts(inp), mustMention(inp), "tr");
    expect(v.ok).toBe(false);
    expect(v.problems.join(" ")).toContain("22");
    expect(v.problems.join(" ")).toContain("şemsiye");
  });

  it("doğru bir yorumu kabul eder", () => {
    const inp = input();
    const ok =
      "Hava 14° gibi görünse de rüzgar yüzünden daha serin hissettirecek, rüzgar ve su geçirmeyen bir mont giy. Akşam 17:00 ile 19:00 arası yağmur var, şemsiyeni unutma, yağmurla birlikte ıslak ve soğuk olacak.";
    const v = validateComment(ok, llmFacts(inp), mustMention(inp), "tr");
    expect(v.problems).toEqual([]);
  });

  it("sayıları normalize eder", () => {
    expect(numbersIn("07:30 ve 2,5 mm")).toEqual(["7", "30", "2.5"]);
  });
});

describe("gün içi uyarı", () => {
  it("uyarılacak bir şey yoksa null", () => {
    expect(composeAlert({ lang: "tr", place: null, rain: [], windMax: 10, gustMax: 20, gustTime: "15:00", severe: [] })).toBeNull();
  });

  it("sert rüzgar (50-62) tek başına uyarı sebebi değil; çok sert (62+) anlaşılır dille uyarılır", () => {
    const base = { lang: "tr" as const, place: null, rain: [], windMax: 25, gustTime: "18:00", severe: [] };
    expect(composeAlert({ ...base, gustMax: 57 })).toBeNull();
    const text = composeAlert({ ...base, gustMax: 66 })!;
    expect(text.split("\n")[0]).toBe("💨 <b>Çok sert rüzgar</b> (18:00 civarı): yürümek zorlaşır, şemsiye işe yaramaz");
    expect(text).toContain("ani hamleler 66 km/s"); // sayı sadece detayda
  });

  it("şiddetli yağmur + fırtına", () => {
    const text = composeAlert({
      lang: "tr",
      place: "Kadıköy",
      rain: [{ from: "17:00", to: "19:00", prob: 90, mm: 12.4, heavy: true, snow: false, minTemp: 12 }],
      windMax: 35,
      gustMax: 80,
      gustTime: "18:00",
      severe: [{ kind: "storm_wind", from: "18:00", to: "19:00", value: 80 }],
    })!;
    expect(text.split("\n")[0]).toBe("⚠️ <b>FIRTINA 18:00–19:00</b>");
    expect(text.split("\n")[1]).toBe("☔ <b>17:00–19:00 ŞİDDETLİ YAĞMUR</b>");
    expect(text).toContain("⚠️ ☔ 17:00–19:00 şiddetli yağmur (%90, 12,4 mm)");
    expect(text).toContain("fırtına, tabela ve kiremit uçabilir (ani rüzgar 80 km/s)");
    expect(text).toContain("yağmurluk");
    console.log(`\n${text}\n`);
  });
});
