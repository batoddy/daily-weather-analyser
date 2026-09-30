# 🌤️ Daily Weather Bot

Her kişiye **kendi seçtiği saatte**, **evden çıkış–dönüş saatleri arasındaki** havaya göre
"ne giyeyim, yanıma ne alayım" mesajı atan Telegram botu. Dönüşten önce yağmur, sert rüzgar
ya da aşırı hava olayı varsa ayrıca uyarır.

```
🧥 MONT  ·  ☔ ŞEMSİYE                   ← bildirimde görünen satır
━━━━━━━━━━━━━━
🌡️ 14° ➜ 9° ➜ 14°  (hissedilen 6°–12°)
📉 Dünden 5° daha soğuk
☔ 17:00–19:00 yağmur
💨 Rüzgarlı, olduğundan soğuk hissettirir

☀️ Günaydın Batuhan!
Rüzgar yüzünden serin hissettirecek, rüzgar ve su geçirmeyen bir mont giy.
Akşam yağmur var, şemsiyeni unutma.

▸ Detaylar (dokununca açılır: saat saat sıcaklık, rüzgar hızı, yağış mm…)
```

Aşırı hava olayı varsa en üstte `⚠️ FIRTINA 16:00–18:00` gibi ayrı bir satır olur.

## Nasıl çalışır

| Parça | Ne |
|---|---|
| Çalışma ortamı | Cloudflare Workers (TypeScript), ücretsiz plan |
| Veri | Cloudflare D1 (SQLite) |
| Zamanlama | Cron her 5 dakikada bir; saati gelen kullanıcıya gönderir (tur başına 10 kişi) |
| Hava verisi | [Open-Meteo](https://open-meteo.com/) (dün + bugün + yarın, saatlik) |
| Konum | Ev ve iş semti, [Nominatim/OSM](https://nominatim.org/) ile aranır; çıkışta ev, gün içinde iş, dönüşte ikisinin kötüsü |
| Yorum | Kural motoru karar verir → Gemini anlatır → doğrulanır; olmazsa şablon |

```
Telegram ──webhook──▶ fetch()     → kurulum, /ayarlar, /simdi … → D1
Cron */5 ──────────▶ scheduled() → zamanı gelenler → Open-Meteo → özet → kurallar → mesaj
```

- **Sayılar** (sıcaklık, hissedilen, rüzgar, yağmur) her zaman koddan gelir; LLM sayı üretmez.
- **Giyim kararı** kural motorundadır ([src/advice/](src/advice/)). Rüzgar ve yağmur kademeyi artırır,
  sıcak ama esintili havada "ince uzun kollu" önerir. Eşikler: [thresholds.ts](src/advice/thresholds.ts).
- **LLM (Gemini)** kararı samimi bir dille anlatır. Çıktıda veride olmayan bir sayı varsa ya da bir
  uyarıya değinilmemişse reddedilir, bir kez tekrar denenir, yine olmazsa şablon metin gider.
- **Gün içi uyarı:** dönüşten 2 saat önce kalan saatlere bakılır. Yağmur, çok sert rüzgar (ani hamle
  ≥ 62 km/s, İstanbul'da yılda ~12 gün) ya da aşırı hava olayı (fırtına, dolu, yoğun kar, buzlanma,
  aşırı sıcak/soğuk) varsa ayrı mesaj gider. Rüzgar sayıyla değil etkisiyle anlatılır.
- **Şehir geneli:** evin çevresindeki ~20 km'lik ızgarada en az 2 noktada şiddetli yağmur, sağanak,
  dolu, yoğun kar ya da buzlanma varsa sabah mesajına ufak bir not düşülür.
- **Erişim:** yeni kullanıcı `/start` yazınca yöneticiye onay isteği düşer.

## Kurulum

Gerekenler: Node.js (portable da olur), bir Telegram hesabı, ücretsiz bir Cloudflare hesabı,
[Gemini API anahtarı](https://aistudio.google.com/).

Portable Node kullanıyorsan önce PATH'e ekle (PowerShell, sadece o pencere için):

```powershell
$env:Path = "C:\Users\batuh\tools\node;$env:Path"
```

1. **Bağımlılıklar:** `npm install`
2. **Telegram botu:** Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → token'ı kopyala.
3. **Cloudflare girişi:** `npx wrangler login`
4. **Veritabanı:**
   ```powershell
   npx wrangler d1 create weather-bot
   ```
   Çıktıdaki `database_id`'yi [wrangler.jsonc](wrangler.jsonc) içine yapıştır, sonra:
   ```powershell
   npm run db:migrate:remote
   ```
5. **Gizli değerler:**
   ```powershell
   npx wrangler secret put TELEGRAM_BOT_TOKEN        # BotFather'dan
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # rastgele uzun bir string (harf/rakam)
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put ADMIN_CHAT_ID             # şimdilik 0 yaz, 8. adımda düzelt
   ```
6. **Deploy:** `npm run deploy` → çıktıdaki `https://daily-weather-bot.<hesap>.workers.dev` adresini not al.
7. **Webhook'u bağla:** tarayıcıda bir kez aç:
   `https://daily-weather-bot.<hesap>.workers.dev/setup?secret=<TELEGRAM_WEBHOOK_SECRET>`
8. **Yönetici ol:** bota `/id` yaz → gelen sayıyı `npx wrangler secret put ADMIN_CHAT_ID` ile kaydet → bota `/start` yaz.

Artık başkaları bota `/start` yazdığında sana onay isteği gelir.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `/start` | Kurulum (onaydan sonra) |
| `/simdi` · `/now` | Anlık rapor (dönüş saati geçtiyse yarının raporu) |
| `/uyari` · `/alert` | Gün içi uyarının şu an ne diyeceği (dönüşe kadar yağmur/rüzgar/aşırı olay) |
| `/ayarlar` · `/settings` | Konum, saatler, hassasiyet, günler, dil |
| `/durdur` · `/stop`, `/devam` · `/resume` | Bildirimleri kapat / aç |
| `/sil` · `/delete` | Tüm veriyi sil |
| `/id` | Sohbet kimliği |
| `/kullanicilar` · `/users` | **Sadece yönetici:** kullanıcılar, durumları, konum/saatler, son rapor; bekleyenler için Onayla/Reddet |

## Lokalde test

Lokal ayarlar `.dev.vars` dosyasında ([.dev.vars.example](.dev.vars.example)'dan kopyala). İlk seferde bir kez:
`npm install` ve `npm run db:migrate:local`.

**1. Tarayıcıda önizleme:** Deploy ve Telegram gerekmez.

```powershell
npm run dev
```

Sonra tarayıcıda aç: <http://localhost:8787/preview?yer=Kadıköy&cikis=08:15&donus=19:00&saat=07:30>

Sayfada sabah mesajı, Gemini'nin ham cevabı ve doğrulama sonucu, `/uyari`'nın ne diyeceği ve kural motorunun kararı görünür.
Parametreler: `yer` (ya da `lat`/`lon`), `cikis`, `donus`, `dil` (tr/en), `hassasiyet` (-1/0/1), `saat` (o saatteymiş gibi), `isim`.

**2. Gerçek Telegram botuyla, kod bilgisayarında:**

1. `.dev.vars`'ta `DRY_RUN=false` yap.
2. Terminal 1: `npm run dev`
3. Terminal 2: `npm run bot:local`. Telegram'dan mesajları çekip lokal sunucuya iletir, dakikada bir zamanlayıcıyı tetikler.
4. Telegram'da bota `/id` yaz. Gelen sayıyı `.dev.vars`'taki `ADMIN_CHAT_ID`'ye koy, Terminal 1'i yeniden başlat (Ctrl+C → `npm run dev`).
5. Bota `/start` yaz.

Bot canlıya alındıysa `bot:local` webhook'u kaldırır. Canlıya dönmek için `/setup` adresini tekrar aç.

**3. Birim testleri:** `npm test` · `npm run typecheck`

## Geliştirme

**Loglar:** `npx wrangler tail` ya da Cloudflare panelinde Workers → daily-weather-bot → Logs.
**Yedek:** `npx wrangler d1 export weather-bot --remote --output yedek.sql`

## Proje yapısı

```
src/
├── index.ts            # webhook + /setup + cron
├── service.ts          # rapor/uyarı üretimi, cron turu
├── schedule.ts         # kime ne zaman ne gider (saf fonksiyonlar)
├── telegram.ts         # Bot API sarmalayıcı (DRY_RUN destekli)
├── time.ts             # saat dilimi ve HH:MM yardımcıları
├── bot/                # komutlar, kurulum adımları, ayarlar, arayüz metinleri
├── weather/            # Open-Meteo, Nominatim, özetleme
├── advice/             # kural motoru + eşikler
├── message/            # mesaj şablonları (tr/en), Gemini, çıktı doğrulama
└── db/                 # D1 erişimi
migrations/             # D1 şeması
test/                   # vitest
```
