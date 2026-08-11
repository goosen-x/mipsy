// Сид справочника тем. Запуск: npm run db:seed (после db:push).
import Database from "better-sqlite3";
import path from "node:path";

const TOPICS: [slug: string, title: string][] = [
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

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
const db = new Database(dbPath);

const insert = db.prepare(
  "INSERT INTO topics (slug, title, sort) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, sort = excluded.sort",
);
db.transaction(() => {
  TOPICS.forEach(([slug, title], i) => insert.run(slug, title, i));
})();

console.log(`Сид тем: ${TOPICS.length} записей в ${dbPath}`);
