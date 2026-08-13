// Вход в личный кабинет: подпись сессии, срок жизни кода и перенос старых
// заявок на аккаунты при обновлении боевой базы.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  codeIsFresh,
  isEmail,
  nowDbTime,
  readSession,
  signSession,
} from "../src/lib/auth-core.ts";

test("кука сессии не подделывается", () => {
  const cookie = signSession(42, "секрет");
  assert.equal(readSession(cookie, "секрет"), 42);
  assert.equal(readSession(cookie, "другой-секрет"), null, "чужой секрет не должен подходить");
  assert.equal(readSession("42.deadbeef", "секрет"), null);
  assert.equal(readSession("43." + cookie.split(".")[1], "секрет"), null, "id подменили");
  assert.equal(readSession(undefined, "секрет"), null);
});

test("код входа живёт 15 минут", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  assert.equal(codeIsFresh(nowDbTime(now), now), true);
  assert.equal(codeIsFresh("2026-08-13 11:50:00", now), true);
  assert.equal(codeIsFresh("2026-08-13 11:44:00", now), false, "через 16 минут код мёртв");
  assert.equal(codeIsFresh(null, now), false);
});

test("адрес почты проверяется до записи в базу", () => {
  for (const good of ["ivan@example.com", "  Anna.Petrova@Mail.RU  ", "psy@клиника.рф"]) {
    assert.ok(isEmail(good), `не принял: ${good}`);
  }
  for (const bad of ["", "ivan", "ivan@", "@example.com", "ivan example.com"]) {
    assert.equal(isEmail(bad), false, `принял мусор: ${bad}`);
  }
});

// --- перенос существующей базы на аккаунты ---

let dir;
let db;

/** Накатывает миграции до указанной включительно и помечает их применёнными. */
function applyUpTo(dbPath, lastFile) {
  const sqlite = new Database(dbPath);
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
  );
  const files = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (file > lastFile) break;
    const statements = readFileSync(path.join("drizzle", file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) sqlite.exec(stmt);
    sqlite.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  }
  sqlite.close();
}

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-accounts-"));
  const dbPath = path.join(dir, "test.db");

  // База, какой она была до личных кабинетов: доступ по токенам, аккаунтов нет.
  applyUpTo(dbPath, "0004_access_meeting_logs.sql");
  const old = new Database(dbPath);
  old
    .prepare(
      "INSERT INTO psychologists (cabinet_token, name, phone, email, moderation_status) VALUES ('t1','Психолог','+70000000001','PSY@Example.com','approved')",
    )
    .run();
  old
    .prepare(
      "INSERT INTO client_requests (for_whom, name, phone, email, pd_consent, client_token) VALUES ('self','Клиент','+70000000002','client@example.com',1,'c1')",
    )
    .run();
  // Второе обращение того же человека — аккаунт должен быть один.
  old
    .prepare(
      "INSERT INTO client_requests (for_whom, name, phone, email, pd_consent, client_token) VALUES ('self','Клиент','+70000000002','Client@Example.com',1,'c2')",
    )
    .run();
  // Заявка без почты: войти нельзя, но и ломаться ничего не должно.
  old
    .prepare(
      "INSERT INTO client_requests (for_whom, name, phone, pd_consent, client_token) VALUES ('self','Безымянный','+70000000003',1,'c3')",
    )
    .run();
  // Записи, которые ссылаются на заявку: перестройка client_requests в 0008
  // не должна их порвать (на боевой базе именно они и ломали миграцию).
  old
    .prepare(
      "INSERT INTO matches (client_request_id, psychologist_id) VALUES ((SELECT id FROM client_requests WHERE client_token = 'c1'), 1)",
    )
    .run();
  old
    .prepare(
      "INSERT INTO slots (psychologist_id, starts_at, status, client_request_id) VALUES (1, '2026-09-01T10:00', 'booked', (SELECT id FROM client_requests WHERE client_token = 'c1'))",
    )
    .run();
  old.close();

  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: "pipe",
  });
  db = new Database(dbPath);
});

after(() => {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
});

test("почта в разных регистрах даёт один аккаунт", () => {
  const rows = db.prepare("SELECT email FROM accounts ORDER BY email").all();
  assert.deepEqual(
    rows.map((r) => r.email),
    ["client@example.com", "psy@example.com"],
  );
});

test("старые заявки и профили привязаны к аккаунтам", () => {
  const linked = db
    .prepare(
      "SELECT client_token, account_id FROM client_requests WHERE account_id IS NOT NULL ORDER BY client_token",
    )
    .all();
  assert.deepEqual(
    linked.map((r) => r.client_token),
    ["c1", "c2"],
    "оба обращения ведут в один кабинет",
  );
  assert.equal(linked[0].account_id, linked[1].account_id);

  const orphan = db.prepare("SELECT account_id FROM client_requests WHERE client_token = 'c3'").get();
  assert.equal(orphan.account_id, null, "без почты аккаунта нет — доступ открывает оператор");

  const psy = db.prepare("SELECT account_id FROM psychologists WHERE cabinet_token = 't1'").get();
  assert.ok(psy.account_id, "у психолога тоже есть аккаунт");
});

test("журнал входов заведён — «код не пришёл» будет чем объяснить", () => {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('login_log')")
    .all()
    .map((c) => c.name);
  assert.deepEqual(columns, ["id", "created_at", "email", "outcome", "detail"]);
});

test("телефон стал необязательным, а связи с заявкой уцелели", () => {
  const phone = db
    .prepare("SELECT \"notnull\" AS required FROM pragma_table_info('client_requests') WHERE name = 'phone'")
    .get();
  assert.equal(phone.required, 0, "телефон больше не обязателен");

  assert.equal(db.prepare("SELECT count(*) c FROM client_requests").get().c, 3);
  assert.equal(db.prepare("SELECT count(*) c FROM matches").get().c, 1);
  assert.equal(
    db.prepare("SELECT count(*) c FROM slots WHERE client_request_id IS NOT NULL").get().c,
    1,
  );
  assert.equal(db.pragma("foreign_key_check").length, 0, "ссылки между таблицами целы");
});

test("коды для новых адресов лежат отдельно от аккаунтов", () => {
  // Аккаунт заводится только после подтверждения почты, поэтому код для
  // незнакомого адреса хранится в своей таблице, а не в accounts.
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('email_codes')")
    .all()
    .map((c) => c.name);
  assert.deepEqual(columns, ["email", "code", "sent_at", "attempts"]);
});

test("секретные коды доступа из старой схемы удалены", () => {
  const columns = db
    .prepare("SELECT name FROM pragma_table_info('client_requests')")
    .all()
    .map((c) => c.name);
  assert.ok(!columns.includes("access_code"));
  assert.ok(columns.includes("account_id"));
});
