// Gemini ile yorum paragrafı. Kararlar kural motorunda; LLM sadece anlatır.
// Hata, boş yanıt ya da doğrulamadan geçmeyen çıktı → null (çağıran şablona düşer).

import { llmFacts, mustMention, templateComment, type ReportInput } from "./report";
import { MAX_COMMENT_CHARS, validateComment } from "./validate";

export const SYSTEM_PROMPT = `Sen bir hava durumu botunun yorum yazarısın. Kullanıcıya bugün ne giymesi ve yanına ne alması gerektiğini anlatan kısa bir paragraf yazarsın.

Sana JSON olarak şunlar verilir:
- Hava verisi (sıcaklıklar, rüzgar, yağmur, aşırı hava olayları)
- "decision": kural motorunun verdiği KESİN karar (giyim, gerekçeler, yanına alınacaklar)
- "draft": kararın doğru ama robotik yazılmış hali

KESİN KURALLAR — hiçbirini esnetme:
1. Sadece JSON'da geçen sayıları kullan. Yeni sayı, saat, yüzde ya da derece üretme. Emin değilsen sayı yazma.
2. "decision.clothing" önerisini değiştirme, hafifletme ya da ağırlaştırma. Aynı öneriyi kendi cümlelerinle söyle.
3. "decision.reasons", "decision.items" ve "severe_events" içindeki her maddeye değin. Bunların dışında uyarı ya da öneri ekleme.
4. Rüzgar ya da yağmur giyim önerisini etkilediyse ("decision.reasons" boş değilse) sebebini açıkla. Örnek: "Hava 15° ama rüzgar yüzünden daha soğuk hissettirecek, rüzgar geçirmeyen bir ceket al."
5. En fazla 2 kısa cümle ve ${MAX_COMMENT_CHARS - 200} karakter. Okuyan kişi yeni uyanmış ve uykulu; tek bakışta anlaşılmalı.
6. Selamlama, emoji, madde işareti, Markdown ya da HTML kullanma. Düz metin yaz.
7. Samimi ve arkadaşça yaz, kısa cümleler kur, teknik terim kullanma ("olasılık", "hamle", "km/s" gibi).
8. Sıcaklık tablosunu ve saatleri tek tek tekrar etme, onlar mesajın üstünde zaten var. Sen neden öyle giymesi gerektiğini anlat.
9. Yanıtı "language" alanındaki dilde yaz.
10. Sadece paragrafı döndür, başka hiçbir şey yazma.`;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface LlmAttempt {
  raw: string | null; // Gemini'nin ham cevabı (hata olduysa null)
  problems: string[]; // doğrulama sorunları ya da hata mesajı
}

export interface CommentResult {
  text: string;
  source: "llm" | "template";
  attempts: LlmAttempt[];
}

/** LLM yorumu, olmazsa şablon. Denemelerin ayrıntısı önizleme ve loglar için döner. */
export async function comment(env: Env, inp: ReportInput): Promise<CommentResult> {
  const attempts: LlmAttempt[] = [];
  if (!env.GEMINI_API_KEY) return { text: templateComment(inp), source: "template", attempts };

  const facts = llmFacts(inp);
  const must = mustMention(inp);
  let userText = JSON.stringify(facts, null, 1);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callGemini(env, userText);
      const v = validateComment(raw, facts, must, inp.lang);
      attempts.push({ raw, problems: v.problems });
      if (v.ok) return { text: v.text, source: "llm", attempts };
      console.warn(`LLM yorumu reddedildi (deneme ${attempt}): ${v.problems.join("; ")}`);
      userText = `${JSON.stringify(facts, null, 1)}\n\nÖnceki yanıtın şu sebeplerle reddedildi, düzelt: ${v.problems.join("; ")}`;
    } catch (e) {
      attempts.push({ raw: null, problems: [String(e)] });
      console.error(`Gemini hatası (deneme ${attempt}):`, e);
    }
  }
  return { text: templateComment(inp), source: "template", attempts };
}

export async function commentFor(env: Env, inp: ReportInput): Promise<string> {
  return (await comment(env, inp)).text;
}

async function callGemini(env: Env, userText: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}/${env.GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
