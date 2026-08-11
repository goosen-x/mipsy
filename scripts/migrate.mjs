// Запускается при старте контейнера: применяет миграции и сидит справочник тем.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

migrate(drizzle(sqlite), { migrationsFolder: path.join(process.cwd(), "drizzle") });

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

console.log(`migrate: схема применена, тем засеяно: ${TOPICS.length} (${dbPath})`);
