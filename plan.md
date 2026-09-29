# Daily Weather Bot — Plan ve Durum

Mimari ve kurulum: [readme.md](readme.md). Bu dosya kararları ve sıradaki işleri tutar.

## Durum (2026-09-29)

- [x] Worker iskeleti, D1 şeması, webhook + `/setup`
- [x] Open-Meteo (dün + bugün + yarın), pencere özeti, aşırı olay tespiti
- [x] Kural motoru (rüzgar/yağmur düzeltmeli giyim kademesi) + testler
- [x] Mesaj şablonları (tr/en), gerçek + hissedilen sıcaklık, dünle fark
- [x] Gemini katmanı + çıktı doğrulama + şablona düşme
- [x] Kurulum akışı, yönetici onayı, `/ayarlar`, `/simdi`, `/durdur`, `/sil`
- [x] Cron zamanlama (kişi başına saat/gün, yaz/kış saati, tekrar gönderim koruması)
- [x] Gün içi uyarı (dönüşten 2 saat önce; yağmur / sert rüzgar / aşırı olay)
- [x] Lokal uçtan uca deneme (DRY_RUN, gerçek hava verisiyle)
- [ ] Canlıya alma: BotFather token, Cloudflare hesabı, D1 oluşturma, secret'lar, deploy
- [ ] Gemini'yi gerçek anahtarla denemek (lokalde anahtar yoktu, şablon yolu test edildi)
- [ ] Birkaç gün kullanıp eşikleri ayarlamak ([thresholds.ts](src/advice/thresholds.ts))

## Kararlar

| Konu | Karar | Not |
|---|---|---|
| Kanal | Telegram botu | Kişi kendi kurulumunu yapar, anlık bildirim |
| Ortam | Cloudflare Workers + D1 | Dakikasında cron, kapanmaz, ücretsiz |
| Erişim | Yönetici onayı | Yeni `/start` → yöneticiye [Onayla]/[Reddet] |
| Yorum | Kural motoru + Gemini + doğrulama | LLM sayı üretmez, kararı değiştiremez |
| Gün içi mesaj | Uyarılacak bir şey varsa | Kalan saatlerde yağmur, sert rüzgar, aşırı olay |
| Günler | Her gün / hafta içi / hafta sonu | Hafta sonuna ayrı saat şimdilik yok |
| Hava verisi | Open-Meteo | MGM'nin resmi API'si yok; MeteoAlarm Türkiye'yi kapsamıyor |
| Konum arama | Nominatim (OSM) | Open-Meteo geocoding "Kadıköy"ü Yalova'daki köye eşliyordu |

### İlk plandan sapmalar

- **MET Norway yedeği kaldırıldı.** Open-Meteo başarısız olursa rapor gönderilmiş sayılmıyor,
  5 dakika sonraki cron turunda tekrar deneniyor (2 saatlik pencere boyunca). Yedek kaynak
  yağmur olasılığı ve hissedilen sıcaklık vermediği için kalitesiz rapor üretiyordu.
- **Rüzgar + yağmur en fazla "mont" kademesine çıkarır.** Hissedilen sıcaklık rüzgarı zaten kısmen
  içerdiği için 6°'de rüzgar + yağmur "bere + eldiven"e çıkıyordu; bu kademe artık sadece
  gerçekten dondurucu soğukta (hissedilen ≤ 0°).
- **"En soğuk" satırı eklendi.** Giyim önerisi en soğuk ana göre veriliyor; o an çıkış/dönüşte değilse
  mesajda ayrıca gösteriliyor, yoksa öneri sayılarla çelişiyormuş gibi görünüyordu.

## Sonra bakılabilecekler

- Hafta sonu için ayrı çıkış/dönüş saatleri
- AB'deki kullanıcılar için resmi uyarılar (MeteoAlarm; Letonya dahil, Türkiye yok)
- Sabah tahmini ile öğlen tahmini arasındaki farkı ("sabahtan beri değişti") uyarıda belirtmek
- Kullanıcı geri bildirimi: mesajın altına [👍 doğruydu] [🥶 üşüdüm] [🥵 terledim] → hassasiyeti otomatik ayarlamak
