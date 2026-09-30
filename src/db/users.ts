// D1 "users" tablosu erişimi.

export type Status = "pending" | "onboarding" | "active" | "paused";
export type Step = "lang" | "location" | "work" | "notify" | "leave" | "return" | "sens" | "days";

export interface User {
  chat_id: number;
  name: string;
  lang: string;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  place_label: string | null; // ev (lat/lon/place_label ev konumudur)
  work_lat: number | null; // iş/okul; boşsa evden çalışıyor
  work_lon: number | null;
  work_label: string | null;
  notify_time: string | null;
  leave_time: string | null;
  return_time: string | null;
  days: string;
  sensitivity: number;
  status: Status;
  step: Step | null;
  pending_places: string | null;
  last_report_date: string | null;
  last_alert_date: string | null;
  created_at: string;
}

/** Kurulumu tamamlanmış kullanıcı: rapor için gereken tüm alanlar dolu. */
export type ReadyUser = User & {
  lat: number;
  lon: number;
  timezone: string;
  notify_time: string;
  leave_time: string;
  return_time: string;
};

export function isReady(u: User): u is ReadyUser {
  return (
    u.lat !== null &&
    u.lon !== null &&
    !!u.timezone &&
    !!u.notify_time &&
    !!u.leave_time &&
    !!u.return_time
  );
}

const UPDATABLE = new Set<keyof User>([
  "name",
  "lang",
  "lat",
  "lon",
  "timezone",
  "place_label",
  "work_lat",
  "work_lon",
  "work_label",
  "notify_time",
  "leave_time",
  "return_time",
  "days",
  "sensitivity",
  "status",
  "step",
  "pending_places",
  "last_report_date",
  "last_alert_date",
]);

export async function getUser(db: D1Database, chatId: number): Promise<User | null> {
  return db.prepare("SELECT * FROM users WHERE chat_id = ?").bind(chatId).first<User>();
}

export async function createUser(db: D1Database, chatId: number, name: string, status: Status, step: Step | null): Promise<User> {
  await db
    .prepare("INSERT INTO users (chat_id, name, status, step) VALUES (?, ?, ?, ?)")
    .bind(chatId, name, status, step)
    .run();
  return (await getUser(db, chatId))!;
}

export async function updateUser(db: D1Database, chatId: number, patch: Partial<User>): Promise<void> {
  const keys = (Object.keys(patch) as (keyof User)[]).filter((k) => UPDATABLE.has(k));
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => patch[k] ?? null);
  await db
    .prepare(`UPDATE users SET ${sets} WHERE chat_id = ?`)
    .bind(...values, chatId)
    .run();
}

export async function deleteUser(db: D1Database, chatId: number): Promise<void> {
  await db.prepare("DELETE FROM users WHERE chat_id = ?").bind(chatId).run();
}

export async function listAll(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare("SELECT * FROM users ORDER BY created_at").all<User>();
  return results;
}

export async function listActive(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare("SELECT * FROM users WHERE status = 'active' ORDER BY notify_time").all<User>();
  return results;
}
