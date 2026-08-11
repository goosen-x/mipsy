// Запускается при старте контейнера: применяет SQL-миграции drizzle и сидит справочник тем.
// Использует только better-sqlite3 — drizzle-orm в standalone-сборку Next не попадает.
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

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
