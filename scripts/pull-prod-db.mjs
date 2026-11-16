#!/usr/bin/env node
// Копия боевой базы для локальной разработки — `npm run db:pull`.
//
// 1. На сервере снимается снимок через VACUUM INTO: без остановки сайта и без
//    риска поймать файл посреди записи.
// 2. Снимок скачивается через ssh (scp на VPS закрыт) и удаляется с сервера.
// 3. Локально данные обезличиваются: почты, телефоны, ответы анкет о состоянии,
//    тексты обращений и отзывов. Психологи, темы, расписание и подборки остаются
//    как есть, чтобы локально было на чём проверять.
// 4. Текущая локальная база сохраняется рядом как mipsy.before-pull-<время>.db.
//
// Админы сохраняют свои почты — локальный вход по коду работает и так.
// Остальные: client-<id>@example.test, psy-<id>@example.test.
// Скан документов и фото (uploads) не копируются — локально ссылки на них пустые.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const HOST = process.env.MIPSY_SSH_HOST ?? "regru";
const REMOTE_DIR = "/root/mipsy-data";
const SNAPSHOT = `pull-${Date.now()}.db`;
const dataDir = path.join(process.cwd(), "data");
const target = path.join(dataDir, "mipsy.db");
const tmp = path.join(dataDir, `.${SNAPSHOT}`);

const ssh = (cmd, opts = {}) =>
  execFileSync("ssh", ["-o", "ConnectTimeout=15", HOST, cmd], { maxBuffer: 1 << 30, ...opts });

mkdirSync(dataDir, { recursive: true });

console.log(`→ Снимок базы на ${HOST}…`);
// Скрипт уходит через stdin — так не нужно экранировать кавычки через ssh и shell.
ssh("docker exec -i mipsy node -", {
  input: `const D = require("better-sqlite3");
new D("/app/data/mipsy.db", { readonly: true }).exec("VACUUM INTO '/app/data/${SNAPSHOT}'");`,
});

try {
  console.log("→ Скачиваю…");
  const bytes = ssh(`cat ${REMOTE_DIR}/${SNAPSHOT}`);
  writeFileSync(tmp, bytes);
} finally {
  ssh(`rm -f ${REMOTE_DIR}/${SNAPSHOT}`);
}

console.log("→ Обезличиваю…");
const db = new Database(tmp);
const has = (table) =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table) !== undefined;
const run = (sql) => db.exec(sql);

db.transaction(() => {
  // Аккаунты: админы остаются собой, остальные — по роли и id.
  run(`
    UPDATE accounts SET
      email = CASE
        WHEN is_admin = 1 THEN email
        WHEN role = 'psychologist' THEN 'psy-' || id || '@example.test'
        ELSE 'client-' || id || '@example.test'
      END,
      name = CASE WHEN is_admin = 1 THEN name ELSE 'Аккаунт ' || id END,
      phone = NULL,
      login_code = NULL, login_code_sent_at = NULL, login_attempts = 0
  `);

  // Обращения клиентов: контакты и всё, что человек рассказал о себе.
  run(`
    UPDATE client_requests SET
      name = 'Клиент ' || id,
      email = 'client-' || COALESCE(account_id, 'r' || id) || '@example.test',
      phone = '+7900' || printf('%07d', id),
      main_problem = NULL, topic_other = NULL, story = NULL,
      freq_down = NULL, freq_sleep = NULL, freq_self_harm = NULL, life_impact = NULL,
      operator_notes = NULL, rematch_reason = NULL,
      client_token = 'local-' || id
  `);

  // Психологи: публичный профиль остаётся, контакты и документы — нет.
  run(`
    UPDATE psychologists SET
      email = 'psy-' || COALESCE(account_id, 'p' || id) || '@example.test',
      phone = '+7901' || printf('%07d', id),
      education_docs = NULL,
      cabinet_token = 'local-' || id,
      calendar_token = CASE WHEN calendar_token IS NULL THEN NULL ELSE 'local-cal-' || id END,
      meeting_url = CASE WHEN meeting_url IS NULL THEN NULL ELSE 'https://example.test/meet/' || id END
  `);

  if (has("support_tickets"))
    run(`UPDATE support_tickets SET name = 'Обращение ' || id, phone = NULL,
         email = 'ticket-' || id || '@example.test', body = '[текст скрыт]', operator_notes = NULL`);
  if (has("reviews")) run(`UPDATE reviews SET author_name = 'Клиент', moderation_notes = NULL`);
  if (has("slots")) run(`UPDATE slots SET meeting_link = NULL`);

  // Журналы с адресами, кодами и сырыми данными платежей локально не нужны.
  for (const t of ["notifications", "login_log", "email_codes", "error_log", "admin_log", "payment_log"]) {
    if (has(t)) run(`DELETE FROM ${t}`);
  }
})();
db.exec("VACUUM");
db.close();

if (existsSync(target)) {
  const backup = path.join(dataDir, `mipsy.before-pull-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  copyFileSync(target, backup);
  console.log(`→ Прежняя локальная база: ${path.relative(process.cwd(), backup)}`);
}
for (const suffix of ["-wal", "-shm"]) rmSync(target + suffix, { force: true });
renameSync(tmp, target);

const check = new Database(target, { readonly: true });
console.log(
  `✓ Готово: ${path.relative(process.cwd(), target)} (${Math.round(statSync(target).size / 1024)} КБ) — ` +
    `психологов ${check.prepare("SELECT count(*) c FROM psychologists").get().c}, ` +
    `заявок ${check.prepare("SELECT count(*) c FROM client_requests").get().c}, ` +
    `тем ${check.prepare("SELECT count(*) c FROM topics").get().c}`,
);
check.close();
console.log("  Перезапустите `npm run dev`: открытый сервер держит прежний файл базы.");
