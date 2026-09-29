// LLM çıktısının kontrolü. Geçmezse yorum şablondan gelir.

import type { Lang } from "./i18n";

export const MAX_COMMENT_CHARS = 450;

export interface Validation {
  ok: boolean;
  text: string; // temizlenmiş metin
  problems: string[];
}

export function validateComment(raw: string, facts: unknown, must: string[][], lang: Lang): Validation {
  const text = raw
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const problems: string[] = [];

  if (!text) problems.push("boş yanıt");
  if (text.length > MAX_COMMENT_CHARS) problems.push(`çok uzun (${text.length} > ${MAX_COMMENT_CHARS} karakter)`);
  if (/[<>]/.test(text)) problems.push("HTML/işaret karakteri içeriyor");

  const allowed = new Set(numbersIn(JSON.stringify(facts)));
  const invented = numbersIn(text).filter((n) => !allowed.has(n));
  if (invented.length > 0) problems.push(`veride olmayan sayılar: ${[...new Set(invented)].join(", ")}`);

  const lower = text.toLocaleLowerCase(lang === "tr" ? "tr-TR" : "en-US");
  for (const group of must) {
    if (!group.some((kw) => lower.includes(kw))) problems.push(`değinilmeyen konu: ${group.join(" / ")}`);
  }

  return { ok: problems.length === 0, text, problems };
}

/** Metindeki sayıları normalize edip döndürür ("2,5" → "2.5", "07" → "7"). */
export function numbersIn(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => String(Number(n.replace(",", "."))));
}
