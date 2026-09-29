// Worker giriş noktası.
//   POST /telegram  → Telegram webhook (bot mesajları)
//   GET  /setup     → webhook + komut menüsünü Telegram'a kaydeder (deploy sonrası bir kez)
//   cron */15       → zamanı gelen kullanıcılara rapor / uyarı

import { COMMANDS } from "./bot/texts";
import { handleUpdate } from "./bot/handlers";
import { preview } from "./preview";
import { runSchedule } from "./service";
import { Telegram, type TgUpdate } from "./telegram";

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/telegram") {
      if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const update = (await req.json()) as TgUpdate;
      // İşleyip öyle dön: aynı sohbetin güncellemeleri sırayla işlensin.
      // Hata olsa da 200 dön; yoksa Telegram aynı güncellemeyi tekrar tekrar gönderir.
      try {
        await handleUpdate(env, update);
      } catch (e) {
        console.error("Update hatası:", e);
      }
      return new Response("ok");
    }

    if (url.pathname === "/setup") {
      if (url.searchParams.get("secret") !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const tg = Telegram.fromEnv(env);
      await tg.call("setWebhook", {
        url: `${url.origin}/telegram`,
        secret_token: env.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"],
      });
      await tg.call("setMyCommands", { commands: COMMANDS.en });
      await tg.call("setMyCommands", { commands: COMMANDS.tr, language_code: "tr" });
      return new Response(`Webhook kuruldu → ${url.origin}/telegram`);
    }

    // Sadece kendi bilgisayarında (wrangler dev): tarayıcıdan rapor önizlemesi
    if (url.pathname === "/preview" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return preview(url, env);
    }

    return new Response("daily-weather-bot ✓");
  },

  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(runSchedule(env));
  },
} satisfies ExportedHandler<Env>;
