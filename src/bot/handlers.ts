// Telegram güncellemelerini işler: onay, kurulum adımları, ayarlar, komutlar.

import { createUser, deleteUser, getUser, isReady, listAll, updateUser, type Step, type User } from "../db/users";
import { asLang, type Lang } from "../message/i18n";
import { escapeHtml } from "../message/report";
import { buildAlert, buildReport, cachedFetcher } from "../service";
import { Telegram, type InlineButton, type TgMessage, type TgUpdate } from "../telegram";
import { localNow, parseTime, toMinutes } from "../time";
import { reverseLabel, searchPlaces, type Place } from "../weather/geocode";
import { lookupTimezone } from "../weather/openmeteo";
import { DAY_PRESETS, TEXTS } from "./texts";

const ONBOARDING: Step[] = ["lang", "location", "work", "notify", "leave", "return", "sens", "days"];

const TIME_OPTIONS: Record<"notify" | "leave" | "return", { times: string[]; perRow: number }> = {
  notify: { times: ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30"], perRow: 3 },
  leave: { times: ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"], perRow: 3 },
  return: { times: ["16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"], perRow: 4 },
};

const COMMAND_ALIASES: Record<string, string> = {
  start: "start",
  simdi: "now",
  now: "now",
  uyari: "alert",
  alert: "alert",
  ayarlar: "settings",
  settings: "settings",
  durdur: "stop",
  stop: "stop",
  devam: "resume",
  resume: "resume",
  sil: "delete",
  delete: "delete",
  yardim: "help",
  help: "help",
  id: "id",
  kullanicilar: "users",
  users: "users",
};

interface Ctx {
  env: Env;
  tg: Telegram;
  chatId: number;
}

export async function handleUpdate(env: Env, update: TgUpdate): Promise<void> {
  const tg = Telegram.fromEnv(env);
  if (update.callback_query) {
    const q = update.callback_query;
    const chatId = q.message?.chat.id ?? q.from.id;
    await handleCallback({ env, tg, chatId }, q.id, q.from.id, q.data ?? "", q.message);
    return;
  }
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return;
  await handleMessage({ env, tg, chatId: msg.chat.id }, msg);
}

// ---------------------------------------------------------------------------
// Mesajlar
// ---------------------------------------------------------------------------

async function handleMessage(ctx: Ctx, msg: TgMessage): Promise<void> {
  const user = await getUser(ctx.env.DB, ctx.chatId);
  const lang = asLang(user?.lang ?? (msg.from?.language_code?.startsWith("tr") ? "tr" : "en"));
  const t = TEXTS[lang];

  const command = msg.text?.match(/^\/([a-z]+)/i)?.[1]?.toLowerCase();
  if (command) {
    await handleCommand(ctx, COMMAND_ALIASES[command] ?? "", user, msg, lang);
    return;
  }

  if (!user) return void (await ctx.tg.send(ctx.chatId, t.notRegistered));
  if (user.status === "pending") return void (await ctx.tg.send(ctx.chatId, t.pendingWait));

  switch (user.step) {
    case "location":
    case "work":
      // Konum butonu sunmuyoruz (o an evde olmayabilir); ama kişi kendisi konum gönderirse kabul et
      if (msg.location) return pickLocation(ctx, user, { lat: msg.location.latitude, lon: msg.location.longitude });
      if (msg.text) return searchLocation(ctx, user, msg.text);
      break;
    case "notify":
    case "leave":
    case "return": {
      const time = msg.text ? parseTime(msg.text) : null;
      if (!time) return void (await ctx.tg.send(ctx.chatId, t.badTime));
      return saveTime(ctx, user, user.step, time);
    }
    case "lang":
    case "sens":
    case "days":
      await ctx.tg.send(ctx.chatId, t.useButtons);
      return ask(ctx, user, user.step);
  }
  await ctx.tg.send(ctx.chatId, t.unknown);
}

async function handleCommand(ctx: Ctx, command: string, user: User | null, msg: TgMessage, lang: Lang): Promise<void> {
  const t = TEXTS[lang];
  const { env, tg, chatId } = ctx;

  switch (command) {
    case "id":
      return void (await tg.send(chatId, `<code>${chatId}</code>`));
    case "help":
      return void (await tg.send(chatId, t.help));
    case "start":
      return start(ctx, user, msg);
    case "users":
      if (String(chatId) === env.ADMIN_CHAT_ID) return listUsers(ctx);
      return void (await tg.send(chatId, t.unknown));
  }

  if (!user) return void (await tg.send(chatId, t.notRegistered));
  if (user.status === "pending") return void (await tg.send(chatId, t.pendingWait));
  if (user.status === "onboarding") {
    await tg.send(chatId, t.notReady);
    return ask(ctx, user, user.step ?? "lang");
  }

  switch (command) {
    case "now":
      return sendReportNow(ctx, user);
    case "alert":
      return sendAlertNow(ctx, user);
    case "settings":
      return showSettings(ctx, user);
    case "stop":
      await updateUser(env.DB, chatId, { status: "paused" });
      return void (await tg.send(chatId, t.paused));
    case "resume":
      await updateUser(env.DB, chatId, { status: "active" });
      return void (await tg.send(chatId, t.resumed));
    case "delete":
      return void (await tg.send(chatId, t.deleteConfirm, {
        inline_keyboard: [[btn(t.btn.deleteYes, "del:yes"), btn(t.btn.deleteNo, "del:no")]],
      }));
  }
  await tg.send(chatId, t.unknown);
}

async function start(ctx: Ctx, user: User | null, msg: TgMessage): Promise<void> {
  const { env, tg, chatId } = ctx;
  const isAdmin = String(chatId) === env.ADMIN_CHAT_ID;
  if (user) {
    // ADMIN_CHAT_ID ayarlanmadan önce /start yazan yönetici "pending"de kalmasın
    if (user.status === "pending" && isAdmin) {
      await updateUser(env.DB, chatId, { status: "onboarding", step: "lang" });
      return ask(ctx, user, "lang");
    }
    if (user.status === "pending") return void (await tg.send(chatId, TEXTS[asLang(user.lang)].pendingWait));
    if (user.status === "onboarding") return ask(ctx, user, user.step ?? "lang");
    return showSettings(ctx, user);
  }

  const name = msg.from?.first_name?.trim() || "👋";
  if (isAdmin) {
    const u = await createUser(env.DB, chatId, name, "onboarding", "lang");
    return ask(ctx, u, "lang");
  }

  const u = await createUser(env.DB, chatId, name, "pending", null);
  const lang = msg.from?.language_code?.startsWith("tr") ? "tr" : "en";
  await tg.send(chatId, TEXTS[lang].pendingSent);
  await tg.send(Number(env.ADMIN_CHAT_ID), TEXTS.tr.adminRequest(escapeHtml(u.name), chatId, msg.from?.username), {
    inline_keyboard: [[btn(TEXTS.tr.btn.approve, `ap:${chatId}`), btn(TEXTS.tr.btn.reject, `rj:${chatId}`)]],
  });
}

// ---------------------------------------------------------------------------
// Buton tıklamaları
// ---------------------------------------------------------------------------

async function handleCallback(ctx: Ctx, queryId: string, fromId: number, data: string, message?: TgMessage): Promise<void> {
  const { env, tg, chatId } = ctx;
  const [key = "", value = ""] = splitOnce(data, ":");

  // Yönetici onayı
  if (key === "ap" || key === "rj") {
    if (String(fromId) !== env.ADMIN_CHAT_ID) return void (await tg.answerCallback(queryId));
    const target = await getUser(env.DB, Number(value));
    await tg.answerCallback(queryId);
    if (!target || target.status !== "pending") {
      if (message) await tg.edit(chatId, message.message_id, TEXTS.tr.stale);
      return;
    }
    const name = escapeHtml(target.name);
    if (key === "ap") {
      await updateUser(env.DB, target.chat_id, { status: "onboarding", step: "lang" });
      await ask({ ...ctx, chatId: target.chat_id }, { ...target, status: "onboarding", step: "lang" }, "lang");
      if (message) await tg.edit(chatId, message.message_id, TEXTS.tr.adminApproved(name));
    } else {
      await deleteUser(env.DB, target.chat_id);
      await tg.send(target.chat_id, TEXTS.tr.rejected);
      if (message) await tg.edit(chatId, message.message_id, TEXTS.tr.adminRejected(name));
    }
    return;
  }

  const user = await getUser(env.DB, chatId);
  const t = TEXTS[asLang(user?.lang)];
  if (!user || user.status === "pending") return void (await tg.answerCallback(queryId, t.stale));
  await tg.answerCallback(queryId);

  // Tıklanan butonun klavyesini kaldır (tekrar tıklanmasın)
  const clearButtons = async () => {
    if (message) await tg.call("editMessageReplyMarkup", { chat_id: chatId, message_id: message.message_id }).catch(() => {});
  };

  switch (key) {
    case "lang":
      if (user.step !== "lang") break;
      await clearButtons();
      await updateUser(env.DB, chatId, { lang: asLang(value) });
      return advance(ctx, { ...user, lang: asLang(value) });

    case "place": {
      if ((user.step !== "location" && user.step !== "work") || !user.pending_places) break;
      const place = (JSON.parse(user.pending_places) as Place[])[Number(value)];
      if (!place) break;
      await clearButtons();
      return pickLocation(ctx, user, place);
    }

    case "work":
      if (user.step !== "work" || value !== "none") break;
      await clearButtons();
      await updateUser(env.DB, chatId, { work_lat: null, work_lon: null, work_label: null, pending_places: null });
      await tg.send(chatId, t.workNone);
      return advance(ctx, { ...user, work_lat: null, work_lon: null, work_label: null });

    case "time":
      if (user.step !== "notify" && user.step !== "leave" && user.step !== "return") break;
      await clearButtons();
      return saveTime(ctx, user, user.step, value);

    case "sens":
      if (user.step !== "sens") break;
      await clearButtons();
      await updateUser(env.DB, chatId, { sensitivity: Number(value) });
      return advance(ctx, { ...user, sensitivity: Number(value) });

    case "days":
      if (user.step !== "days" || !/^[01]{7}$/.test(value)) break;
      await clearButtons();
      await updateUser(env.DB, chatId, { days: value });
      return advance(ctx, { ...user, days: value });

    case "edit":
      if (user.status === "onboarding" || !ONBOARDING.includes(value as Step)) break;
      await updateUser(env.DB, chatId, { step: value as Step });
      return ask(ctx, { ...user, step: value as Step }, value as Step);

    case "pause":
    case "resume": {
      if (user.status === "onboarding") break;
      const status = key === "pause" ? "paused" : "active";
      await updateUser(env.DB, chatId, { status });
      if (message) await tg.edit(chatId, message.message_id, ...settingsView({ ...user, status }));
      return;
    }

    case "del":
      await clearButtons();
      if (value === "yes") {
        await deleteUser(env.DB, chatId);
        return void (await tg.send(chatId, t.deleted));
      }
      return void (await tg.send(chatId, t.cancelled));
  }
  await tg.send(chatId, t.stale);
}

// ---------------------------------------------------------------------------
// Adımlar
// ---------------------------------------------------------------------------

async function ask(ctx: Ctx, user: User, step: Step): Promise<void> {
  const t = TEXTS[asLang(user.lang)];
  const { tg, chatId } = ctx;
  switch (step) {
    case "lang":
      return void (await tg.send(chatId, t.askLang, {
        inline_keyboard: [[btn("🇹🇷 Türkçe", "lang:tr"), btn("🇬🇧 English", "lang:en")]],
      }));
    case "location":
      return void (await tg.send(chatId, t.askHome));
    case "work":
      return void (await tg.send(chatId, t.askWork, { inline_keyboard: [[btn(t.btn.workNone, "work:none")]] }));
    case "notify":
    case "leave":
    case "return": {
      const prompt = { notify: t.askNotify, leave: t.askLeave, return: t.askReturn }[step];
      const { times, perRow } = TIME_OPTIONS[step];
      const buttons = times.map((time) => btn(time, `time:${time}`));
      const rows: InlineButton[][] = [];
      for (let i = 0; i < buttons.length; i += perRow) rows.push(buttons.slice(i, i + perRow));
      return void (await tg.send(chatId, prompt, { inline_keyboard: rows }));
    }
    case "sens":
      return void (await tg.send(chatId, t.askSens, {
        inline_keyboard: [[1, 0, -1].map((v) => btn(t.sens[v]!, `sens:${v}`))],
      }));
    case "days":
      return void (await tg.send(chatId, t.askDays, {
        inline_keyboard: [
          [
            btn(t.days.all, `days:${DAY_PRESETS.all}`),
            btn(t.days.weekdays, `days:${DAY_PRESETS.weekdays}`),
            btn(t.days.weekend, `days:${DAY_PRESETS.weekend}`),
          ],
        ],
      }));
  }
}

/** Kurulumdaysa sonraki adıma, ayar düzenliyorsa ayarlar ekranına döner. */
async function advance(ctx: Ctx, user: User): Promise<void> {
  const { env, tg, chatId } = ctx;
  if (user.status !== "onboarding") {
    await updateUser(env.DB, chatId, { step: null });
    return showSettings(ctx, { ...user, step: null });
  }

  const next = ONBOARDING[ONBOARDING.indexOf(user.step ?? "lang") + 1];
  if (next) {
    await updateUser(env.DB, chatId, { step: next });
    return ask(ctx, { ...user, step: next }, next);
  }

  // Kurulum bitti
  const done: User = { ...user, status: "active", step: null };
  await updateUser(env.DB, chatId, { status: "active", step: null });
  await tg.send(chatId, TEXTS[asLang(user.lang)].done(user.notify_time ?? ""));
  await sendReportNow(ctx, done, true);
}

async function searchLocation(ctx: Ctx, user: User, query: string): Promise<void> {
  const t = TEXTS[asLang(user.lang)];
  let places: Place[];
  try {
    places = await searchPlaces(query, user.lang);
  } catch (e) {
    console.error("Nominatim:", e);
    return void (await ctx.tg.send(ctx.chatId, t.placeError));
  }
  if (places.length === 0) return void (await ctx.tg.send(ctx.chatId, t.placeNotFound));
  if (places.length === 1) return pickLocation(ctx, user, places[0]!);

  await updateUser(ctx.env.DB, ctx.chatId, { pending_places: JSON.stringify(places) });
  await ctx.tg.send(ctx.chatId, t.placeChoose, {
    inline_keyboard: places.map((p, i) => [btn(p.label, `place:${i}`)]),
  });
}

async function pickLocation(ctx: Ctx, user: User, place: { lat: number; lon: number; label?: string }): Promise<void> {
  const t = TEXTS[asLang(user.lang)];
  // ~1 km hassasiyet
  const lat = Math.round(place.lat * 100) / 100;
  const lon = Math.round(place.lon * 100) / 100;

  if (user.step === "work") {
    // Saat dilimi evden gelir; iş için sadece konum ve etiket
    const label = place.label ?? (await reverseLabel(place.lat, place.lon, user.lang));
    const patch = { work_lat: lat, work_lon: lon, work_label: label, pending_places: null };
    await updateUser(ctx.env.DB, ctx.chatId, patch);
    await ctx.tg.send(ctx.chatId, t.workSaved(escapeHtml(label ?? `${lat}, ${lon}`)));
    return advance(ctx, { ...user, ...patch });
  }

  let timezone: string;
  try {
    timezone = await lookupTimezone(lat, lon);
  } catch (e) {
    console.error("Timezone:", e);
    return void (await ctx.tg.send(ctx.chatId, t.placeError));
  }
  const label = place.label ?? (await reverseLabel(place.lat, place.lon, user.lang));
  const patch = { lat, lon, timezone, place_label: label, pending_places: null };
  await updateUser(ctx.env.DB, ctx.chatId, patch);
  await ctx.tg.send(ctx.chatId, t.placeSaved(escapeHtml(label ?? `${lat}, ${lon}`)));
  return advance(ctx, { ...user, ...patch });
}

async function saveTime(ctx: Ctx, user: User, step: "notify" | "leave" | "return", time: string): Promise<void> {
  const column = { notify: "notify_time", leave: "leave_time", return: "return_time" } as const;
  const patch: Partial<User> = { [column[step]]: time };
  // Saat değişince bugünün raporu/uyarısı yeni saatte tekrar gidebilsin (ör. denemek için 10 dk sonraya kurmak)
  if (user.status !== "onboarding") Object.assign(patch, { last_report_date: null, last_alert_date: null });
  await updateUser(ctx.env.DB, ctx.chatId, patch);
  return advance(ctx, { ...user, ...patch });
}

// ---------------------------------------------------------------------------
// Rapor ve ayarlar
// ---------------------------------------------------------------------------

async function sendReportNow(ctx: Ctx, user: User, afterOnboarding = false): Promise<void> {
  const t = TEXTS[asLang(user.lang)];
  if (!isReady(user)) return void (await ctx.tg.send(ctx.chatId, t.notReady));
  const now = localNow(user.timezone);
  try {
    const text = await buildReport(ctx.env, user, now, cachedFetcher());
    await ctx.tg.send(ctx.chatId, text ?? t.reportError);
    // Kurulum mesaj saatinden sonra bittiyse, zamanlayıcı bugün ikinci kez göndermesin
    if (afterOnboarding && now.minutes >= toMinutes(user.notify_time)) {
      await updateUser(ctx.env.DB, ctx.chatId, { last_report_date: now.date });
    }
  } catch (e) {
    console.error("Anlık rapor:", e);
    await ctx.tg.send(ctx.chatId, t.reportError);
  }
}

/** Yönetici: tüm kullanıcılar ve durumları. Onay bekleyenlerin altına Onayla/Reddet butonları gelir. */
async function listUsers(ctx: Ctx): Promise<void> {
  const t = TEXTS.tr;
  const users = await listAll(ctx.env.DB);
  const count = (s: User["status"]) => users.filter((u) => u.status === s).length;
  await ctx.tg.send(
    ctx.chatId,
    t.usersTitle(users.length, count("active"), count("paused"), count("pending"), count("onboarding")),
  );

  // Telegram mesaj sınırı 4096 karakter: kullanıcıları gruplar halinde gönder
  let chunk: string[] = [];
  const flush = async () => {
    if (chunk.length > 0) await ctx.tg.send(ctx.chatId, chunk.join("\n\n"));
    chunk = [];
  };
  for (const u of users) {
    const block = userBlock(u, String(u.chat_id) === ctx.env.ADMIN_CHAT_ID);
    if (u.status === "pending") {
      // Bekleyenler ayrı mesaj: butonlar doğru kişiye bağlı kalsın
      await flush();
      await ctx.tg.send(ctx.chatId, block, {
        inline_keyboard: [[btn(t.btn.approve, `ap:${u.chat_id}`), btn(t.btn.reject, `rj:${u.chat_id}`)]],
      });
      continue;
    }
    if ([...chunk, block].join("\n\n").length > 3800) await flush();
    chunk.push(block);
  }
  await flush();
}

function userBlock(u: User, isAdmin: boolean): string {
  const t = TEXTS.tr;
  const name = `<b>${escapeHtml(u.name)}</b>${isAdmin ? " (sen)" : ""}`;
  const icon = { active: "✅", paused: "⏸", pending: "⏳", onboarding: "🛠" }[u.status];
  const lines = [`${icon} ${name} · <code>${u.chat_id}</code>`];
  if (u.status === "pending") {
    lines.push(`   ${t.userPending(shortDate(u.created_at.slice(0, 10)))}`);
    return lines.join("\n");
  }
  if (u.status === "onboarding") lines.push(`   ${t.userOnboarding(u.step ?? "—")}`);
  if (u.place_label || u.lat !== null) lines.push(`   🏠 ${escapeHtml(u.place_label ?? `${u.lat}, ${u.lon}`)}`);
  if (u.work_label || u.work_lat !== null) lines.push(`   🏢 ${escapeHtml(u.work_label ?? `${u.work_lat}, ${u.work_lon}`)}`);
  if (u.notify_time) {
    const preset = (Object.keys(DAY_PRESETS) as (keyof typeof DAY_PRESETS)[]).find((k) => DAY_PRESETS[k] === u.days);
    lines.push(
      `   ⏰ ${u.notify_time} · 🚪 ${u.leave_time ?? "—"} · 🏠 ${u.return_time ?? "—"} · 📅 ${preset ? t.days[preset] : u.days} · ${t.sens[u.sensitivity] ?? ""}`,
    );
  }
  if (u.status !== "onboarding") {
    lines.push(`   ${t.userLastReport(u.last_report_date ? shortDate(u.last_report_date) : null)} · ${u.lang === "en" ? "🇬🇧" : "🇹🇷"}`);
  }
  return lines.join("\n");
}

/** "2026-09-30" → "30 Eyl" */
function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getUTCDate()} ${TEXTS.tr.monthsShort[d.getUTCMonth()]}`;
}

/** Gün içi uyarının şu an ne diyeceği (zamanlamayı beklemeden). */
async function sendAlertNow(ctx: Ctx, user: User): Promise<void> {
  const t = TEXTS[asLang(user.lang)];
  if (!isReady(user)) return void (await ctx.tg.send(ctx.chatId, t.notReady));
  try {
    const text = await buildAlert(user, localNow(user.timezone), cachedFetcher());
    await ctx.tg.send(ctx.chatId, text ?? t.noAlert);
  } catch (e) {
    console.error("Anlık uyarı:", e);
    await ctx.tg.send(ctx.chatId, t.reportError);
  }
}

async function showSettings(ctx: Ctx, user: User): Promise<void> {
  await ctx.tg.send(ctx.chatId, ...settingsView(user));
}

function settingsView(user: User): [string, { inline_keyboard: InlineButton[][] }] {
  const t = TEXTS[asLang(user.lang)];
  const preset = (Object.keys(DAY_PRESETS) as (keyof typeof DAY_PRESETS)[]).find((k) => DAY_PRESETS[k] === user.days);
  const text = [
    t.settingsTitle,
    t.settingsLines({
      place: escapeHtml(user.place_label ?? (user.lat !== null ? `${user.lat}, ${user.lon}` : "—")),
      work: user.work_label ? escapeHtml(user.work_label) : user.work_lat !== null ? `${user.work_lat}, ${user.work_lon}` : null,
      notify: user.notify_time ?? "—",
      leave: user.leave_time ?? "—",
      ret: user.return_time ?? "—",
      sens: t.sens[user.sensitivity] ?? "—",
      days: preset ? t.days[preset] : t.daysCustom(user.days),
      active: user.status === "active",
    }),
  ].join("\n\n");
  const keyboard = [
    [btn(t.btn.location, "edit:location"), btn(t.btn.work, "edit:work"), btn(t.btn.lang, "edit:lang")],
    [btn(t.btn.notify, "edit:notify"), btn(t.btn.leave, "edit:leave"), btn(t.btn.ret, "edit:return")],
    [btn(t.btn.sens, "edit:sens"), btn(t.btn.days, "edit:days")],
    [user.status === "active" ? btn(t.btn.pause, "pause:") : btn(t.btn.resume, "resume:")],
  ];
  return [text, { inline_keyboard: keyboard }];
}

function btn(text: string, callback_data: string): InlineButton {
  return { text, callback_data };
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + sep.length)];
}
