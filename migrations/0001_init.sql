-- Kullanıcılar: her Telegram sohbeti bir satır
CREATE TABLE users (
  chat_id          INTEGER PRIMARY KEY,
  name             TEXT    NOT NULL,
  lang             TEXT    NOT NULL DEFAULT 'tr',          -- tr | en
  lat              REAL,
  lon              REAL,
  timezone         TEXT,
  place_label      TEXT,                                    -- "Kadıköy"
  notify_time      TEXT,                                    -- "07:30" (yerel)
  leave_time       TEXT,                                    -- "08:15"
  return_time      TEXT,                                    -- "19:00"
  days             TEXT    NOT NULL DEFAULT '1111111',      -- Pzt..Paz
  sensitivity      INTEGER NOT NULL DEFAULT 0,              -- -1 sıcaklarım, 0 normal, 1 üşürüm
  status           TEXT    NOT NULL DEFAULT 'pending',      -- pending | onboarding | active | paused
  step             TEXT,                                    -- onboarding / ayar düzenleme adımı
  pending_places   TEXT,                                    -- şehir aramasında çıkan seçenekler (JSON)
  last_report_date TEXT,                                    -- sabah raporunun gittiği yerel tarih
  last_alert_date  TEXT,                                    -- gün içi uyarı kontrolünün yapıldığı yerel tarih
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX users_status ON users(status);
