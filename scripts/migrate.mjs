// Запускается при старте контейнера: применяет SQL-миграции drizzle и сидит справочник тем.
// Использует только better-sqlite3 — drizzle-orm в standalone-сборку Next не попадает.
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
// Перестройка таблицы (12-шаговая процедура SQLite: создать новую → скопировать →
// удалить старую → переименовать) невозможна при включённой проверке ссылок,
// а better-sqlite3 включает её по умолчанию. Выключаем на время миграций и
// проверяем целостность до того, как отдать базу приложению.
sqlite.pragma("foreign_keys = OFF");

sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))");

const dir = path.join(process.cwd(), "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const isApplied = sqlite.prepare("SELECT 1 FROM _migrations WHERE name = ?");
const markApplied = sqlite.prepare("INSERT INTO _migrations (name) VALUES (?)");

for (const file of files) {
  if (isApplied.get(file)) continue;
  const statements = readFileSync(path.join(dir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  sqlite.transaction(() => {
    for (const stmt of statements) sqlite.exec(stmt);
    markApplied.run(file);
  })();
  console.log(`migrate: применена ${file} (${statements.length} statements)`);
}

const violations = sqlite.pragma("foreign_key_check");
if (violations.length > 0) {
  console.error("migrate: миграции сломали ссылки между таблицами", violations.slice(0, 5));
  process.exit(1);
}
sqlite.pragma("foreign_keys = ON");

// Старым заявкам, созданным до появления кабинета клиента, выдаём токен.
const needToken = sqlite.prepare("SELECT id FROM client_requests WHERE client_token IS NULL").all();
if (needToken.length > 0) {
  const setToken = sqlite.prepare("UPDATE client_requests SET client_token = ? WHERE id = ?");
  sqlite.transaction(() => {
    for (const row of needToken) setToken.run(crypto.randomUUID(), row.id);
  })();
  console.log(`migrate: выдано токенов клиентам: ${needToken.length}`);
}

// Держать в согласии с src/db/seed.ts
const TOPICS = [
  ["anxiety", "Тревога и страхи"],
  ["depression", "Подавленность, депрессия"],
  ["self-esteem", "Самооценка и уверенность"],
  ["relationships", "Отношения с партнёром"],
  ["family", "Семейные конфликты"],
  ["burnout", "Выгорание и усталость"],
  ["loss", "Утрата, горевание"],
  ["childhood-trauma", "Детский опыт и травма"],
  ["loneliness", "Одиночество"],
  ["work-study", "Работа и учёба"],
  ["life-changes", "Резкие перемены в жизни"],
  ["sleep", "Проблемы со сном"],
  ["eating", "Пищевое поведение"],
  ["anger", "Гнев и раздражительность"],
  ["intimacy", "Интимные трудности"],
  ["parenting", "Родительство"],
];

const insert = sqlite.prepare(
  "INSERT INTO topics (slug, title, sort) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, sort = excluded.sort",
);
sqlite.transaction(() => {
  TOPICS.forEach(([slug, title], i) => insert.run(slug, title, i));
})();

console.log(`migrate: схема актуальна, тем засеяно: ${TOPICS.length} (${dbPath})`);
