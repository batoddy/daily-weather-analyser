// Lokal bot köprüsü: gerçek Telegram botunla konuşurken kod bilgisayarında (wrangler dev) çalışır.
// Telegram lokal sunucuya ulaşamadığı için mesajları getUpdates ile çekip lokal /telegram'a iletir,
// her dakika da zamanlayıcıyı (cron) tetikler.
//
// Kullanım: 1) npm run dev   2) başka bir terminalde: npm run bot:local
// .dev.vars içinde DRY_RUN=false olmalı (yoksa bot cevapları sadece konsola yazılır).
//
// Not: Bot canlıda (webhook bağlıyken) çalışıyorsa bu script webhook'u kaldırır;
// sonra canlıya dönmek için /setup adresini tekrar açmak gerekir.

import { readFileSync } from "node:fs";

const LOCAL = process.env.LOCAL_URL ?? "http://127.0.0.1:8787";
const CRON_EVERY_MS = 60_000;

const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const token = vars.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error(".dev.vars içinde TELEGRAM_BOT_TOKEN boş");
if (vars.DRY_RUN === "true") console.warn("⚠️  DRY_RUN=true: bot cevapları Telegram'a gitmez, sadece wrangler dev konsoluna yazılır.\n");

const tg = async (method, params = {}) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
};

const me = await tg("getMe");
await tg("deleteWebhook");
console.log(`🤖 @${me.username} lokal modda. Telegram'da bota yaz; Ctrl+C ile çık.`);
console.log(`   Yönetici olmak için: bota /id yaz → sayıyı .dev.vars'taki ADMIN_CHAT_ID'ye koy → npm run dev'i yeniden başlat.\n`);

// Zamanlayıcı: her dakika cron'u tetikle (canlıda 5 dakikada bir çalışır; mantık aynı)
setInterval(async () => {
  try {
    await fetch(`${LOCAL}/__scheduled?cron=*/5+*+*+*+*`);
  } catch {
    console.warn("⏰ cron tetiklenemedi (npm run dev çalışıyor mu?)");
  }
}, CRON_EVERY_MS);

let offset = 0;
for (;;) {
  let updates = [];
  try {
    updates = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
  } catch (e) {
    console.error("getUpdates:", e.message);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  for (const u of updates) {
    offset = u.update_id + 1;
    const from = u.message?.from ?? u.callback_query?.from;
    const what = u.message?.text ?? (u.message?.location ? "📍 konum" : u.callback_query ? `[${u.callback_query.data}]` : "?");
    console.log(`← ${from?.first_name ?? "?"} (${from?.id}): ${what}`);
    try {
      const res = await fetch(`${LOCAL}/telegram`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": vars.TELEGRAM_WEBHOOK_SECRET },
        body: JSON.stringify(u),
      });
      if (!res.ok) console.error(`   lokal sunucu ${res.status} döndü`);
    } catch {
      console.error("   lokal sunucuya ulaşılamadı (npm run dev çalışıyor mu?)");
    }
  }
}
