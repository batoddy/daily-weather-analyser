// Botun arayüz metinleri (tr / en).

import type { Lang } from "../message/i18n";

export const DAY_PRESETS = { all: "1111111", weekdays: "1111100", weekend: "0000011" } as const;

const tr = {
  pendingSent: "Merhaba! 👋 İsteğini yöneticiye ilettim. Onaylanınca buradan haber vereceğim.",
  pendingWait: "İsteğin hâlâ onay bekliyor ⏳",
  rejected: "Üzgünüm, isteğin onaylanmadı. / Sorry, your request was not approved.",
  askLang: "🌐 Dil seç / Choose language",
  askLocation:
    "📍 Konumunu paylaş (aşağıdaki buton, telefondan) ya da semt/şehir adını yaz.\n<i>Konum yaklaşık 1 km hassasiyetle saklanır.</i>",
  shareLocationButton: "📍 Konumumu paylaş",
  placeNotFound: 'Bulamadım 🤔 Başka türlü yazmayı dene (ör. "Kadıköy, İstanbul").',
  placeChoose: "Hangisi?",
  placeSaved: (label: string) => `📍 Konum: <b>${label}</b>`,
  placeError: "Konumu şu an işleyemedim, biraz sonra tekrar dene.",
  askNotify: "⏰ Sabah mesajı kaçta gelsin?\n<i>Butonlardan seç ya da yaz (ör. 07:45).</i>",
  askLeave: "🚪 Kaçta evden çıkıyorsun?\n<i>Butonlardan seç ya da yaz (ör. 08:15).</i>",
  askReturn: "🏠 Kaçta eve dönüyorsun?\n<i>Butonlardan seç ya da yaz (ör. 18:30).</i>",
  badTime: "Saati anlayamadım, 07:45 gibi yaz.",
  askSens: "🥶 Soğuğa karşı nasılsın?",
  sens: { 1: "🥶 Çabuk üşürüm", 0: "🙂 Normal", [-1]: "🥵 Sıcaklarım" } as Record<number, string>,
  askDays: "📅 Hangi günler mesaj gelsin?",
  days: { all: "Her gün", weekdays: "Hafta içi", weekend: "Hafta sonu" },
  daysCustom: (d: string) => d,
  useButtons: "Lütfen butonlardan birini seç 👆",
  done: (notify: string) =>
    `✅ Hazırsın! Her gün <b>${notify}</b>'de mesaj atacağım. Dönüşünden önce yağmur, sert rüzgar ya da aşırı hava olayı varsa ayrıca uyarırım.\n\nİlk raporun 👇`,
  settingsTitle: "⚙️ <b>Ayarların</b>",
  settingsLines: (s: SettingsView) =>
    [
      `📍 Konum: ${s.place}`,
      `⏰ Mesaj: ${s.notify}`,
      `🚪 Çıkış: ${s.leave} · 🏠 Dönüş: ${s.ret}`,
      `🥶 Soğuğa karşı: ${s.sens}`,
      `📅 Günler: ${s.days}`,
      `🌐 Dil: Türkçe`,
      `Durum: ${s.active ? "✅ Aktif" : "⏸ Durduruldu"}`,
    ].join("\n"),
  btn: {
    location: "📍 Konum",
    lang: "🌐 Dil",
    notify: "⏰ Mesaj saati",
    leave: "🚪 Çıkış",
    ret: "🏠 Dönüş",
    sens: "🥶 Hassasiyet",
    days: "📅 Günler",
    pause: "⏸ Durdur",
    resume: "▶️ Devam",
    approve: "✅ Onayla",
    reject: "❌ Reddet",
    deleteYes: "🗑 Evet, sil",
    deleteNo: "Vazgeç",
  },
  paused: "⏸ Bildirimler durduruldu. Tekrar açmak için /devam",
  resumed: "▶️ Bildirimler açıldı.",
  deleteConfirm: "Tüm verin silinecek. Emin misin?",
  deleted: "🗑 Verin silindi. Tekrar başlamak istersen /start",
  cancelled: "Tamam, vazgeçildi.",
  notReady: "Önce kurulumu tamamla: /start",
  notRegistered: "Başlamak için /start yaz.",
  stale: "Bu seçenek artık geçerli değil.",
  reportError: "Şu an hava verisine ulaşamadım, biraz sonra tekrar dene.",
  noAlert: "✅ Bugün dönüşüne kadar yağmur, sert rüzgar ya da aşırı hava olayı görünmüyor.",
  unknown: "Anlayamadım 🤔 Komutlar için /yardim",
  help: [
    "<b>Komutlar</b>",
    "/simdi — anlık rapor",
    "/uyari — dönüşüne kadar uyarılacak bir şey var mı?",
    "/ayarlar — konum, saatler, hassasiyet, günler",
    "/durdur — bildirimleri durdur",
    "/devam — bildirimleri aç",
    "/sil — tüm verimi sil",
    "/id — sohbet kimliğim",
  ].join("\n"),
  adminRequest: (name: string, id: number, username?: string) =>
    `🆕 Yeni kullanıcı isteği\n<b>${name}</b>${username ? ` (@${username})` : ""}\nid: <code>${id}</code>`,
  adminApproved: (name: string) => `✅ ${name} onaylandı.`,
  adminRejected: (name: string) => `❌ ${name} reddedildi.`,
};

export interface SettingsView {
  place: string;
  notify: string;
  leave: string;
  ret: string;
  sens: string;
  days: string;
  active: boolean;
}

type Texts = typeof tr;

const en: Texts = {
  pendingSent: "Hi! 👋 I've forwarded your request to the admin. I'll let you know here once it's approved.",
  pendingWait: "Your request is still waiting for approval ⏳",
  rejected: tr.rejected,
  askLang: tr.askLang,
  askLocation:
    "📍 Share your location (button below, from your phone) or type your neighbourhood/city.\n<i>Location is stored with ~1 km precision.</i>",
  shareLocationButton: "📍 Share my location",
  placeNotFound: 'Couldn\'t find it 🤔 Try another way (e.g. "Kreuzberg, Berlin").',
  placeChoose: "Which one?",
  placeSaved: (label) => `📍 Location: <b>${label}</b>`,
  placeError: "Couldn't process the location right now, please try again later.",
  askNotify: "⏰ When should the morning message arrive?\n<i>Pick a button or type it (e.g. 07:45).</i>",
  askLeave: "🚪 When do you leave home?\n<i>Pick a button or type it (e.g. 08:15).</i>",
  askReturn: "🏠 When do you get back home?\n<i>Pick a button or type it (e.g. 18:30).</i>",
  badTime: "I couldn't read that time, type it like 07:45.",
  askSens: "🥶 How do you handle the cold?",
  sens: { 1: "🥶 I get cold easily", 0: "🙂 Normal", [-1]: "🥵 I run warm" },
  askDays: "📅 Which days should I message you?",
  days: { all: "Every day", weekdays: "Weekdays", weekend: "Weekends" },
  daysCustom: (d) => d,
  useButtons: "Please pick one of the buttons 👆",
  done: (notify) =>
    `✅ All set! I'll message you every day at <b>${notify}</b>. If rain, strong wind or severe weather is coming before you get home, I'll warn you separately.\n\nYour first report 👇`,
  settingsTitle: "⚙️ <b>Your settings</b>",
  settingsLines: (s) =>
    [
      `📍 Location: ${s.place}`,
      `⏰ Message: ${s.notify}`,
      `🚪 Leave: ${s.leave} · 🏠 Back: ${s.ret}`,
      `🥶 Cold tolerance: ${s.sens}`,
      `📅 Days: ${s.days}`,
      `🌐 Language: English`,
      `Status: ${s.active ? "✅ Active" : "⏸ Paused"}`,
    ].join("\n"),
  btn: {
    location: "📍 Location",
    lang: "🌐 Language",
    notify: "⏰ Message time",
    leave: "🚪 Leave",
    ret: "🏠 Back",
    sens: "🥶 Cold tolerance",
    days: "📅 Days",
    pause: "⏸ Pause",
    resume: "▶️ Resume",
    approve: tr.btn.approve,
    reject: tr.btn.reject,
    deleteYes: "🗑 Yes, delete",
    deleteNo: "Cancel",
  },
  paused: "⏸ Notifications paused. To turn them back on: /resume",
  resumed: "▶️ Notifications resumed.",
  deleteConfirm: "All your data will be deleted. Are you sure?",
  deleted: "🗑 Your data has been deleted. To start again: /start",
  cancelled: "OK, cancelled.",
  notReady: "Finish the setup first: /start",
  notRegistered: "Type /start to begin.",
  stale: "This option is no longer valid.",
  reportError: "Couldn't reach the weather service right now, please try again later.",
  noAlert: "✅ No rain, strong wind or severe weather expected before you get home today.",
  unknown: "I didn't get that 🤔 See /help",
  help: [
    "<b>Commands</b>",
    "/now — report right now",
    "/alert — anything to watch out for before I get home?",
    "/settings — location, times, cold tolerance, days",
    "/stop — pause notifications",
    "/resume — resume notifications",
    "/delete — delete all my data",
    "/id — my chat id",
  ].join("\n"),
  adminRequest: tr.adminRequest,
  adminApproved: tr.adminApproved,
  adminRejected: tr.adminRejected,
};

export const TEXTS: Record<Lang, Texts> = { tr, en };

export const COMMANDS: Record<Lang, { command: string; description: string }[]> = {
  tr: [
    { command: "simdi", description: "Anlık rapor" },
    { command: "uyari", description: "Dönüşe kadar uyarı var mı?" },
    { command: "ayarlar", description: "Ayarlar" },
    { command: "durdur", description: "Bildirimleri durdur" },
    { command: "devam", description: "Bildirimleri aç" },
    { command: "yardim", description: "Yardım" },
  ],
  en: [
    { command: "now", description: "Report right now" },
    { command: "alert", description: "Any warnings before I get home?" },
    { command: "settings", description: "Settings" },
    { command: "stop", description: "Pause notifications" },
    { command: "resume", description: "Resume notifications" },
    { command: "help", description: "Help" },
  ],
};
