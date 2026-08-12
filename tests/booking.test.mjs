// Проверяем инварианты записи на встречу против настоящей SQLite-базы.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

let dir;
let db;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-test-"));
  const dbPath = path.join(dir, "test.db");
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: "pipe",
  });
  db = new Database(dbPath);
  db.prepare(
    "INSERT INTO psychologists (cabinet_token, slug, name, phone, moderation_status) VALUES ('t1','p-1','Тест','+70000000001','approved')",
  ).run();
  db.prepare(
    "INSERT INTO client_requests (for_whom, name, phone, pd_consent, client_token) VALUES ('self','Клиент А','+70000000002',1,'ca')",
  ).run();
  db.prepare(
    "INSERT INTO client_requests (for_whom, name, phone, pd_consent, client_token) VALUES ('self','Клиент Б','+70000000003',1,'cb')",
  ).run();
  db.prepare(
    "INSERT INTO slots (psychologist_id, starts_at, duration_min) VALUES (1,'2026-12-01T18:00',50)",
  ).run();
});

after(() => {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
});

test("миграции создают все таблицы и справочник тем", () => {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);
  for (const t of ["client_requests", "psychologists", "matches", "slots", "notifications", "topics"]) {
    assert.ok(tables.includes(t), `нет таблицы ${t}`);
  }
  assert.equal(db.prepare("SELECT count(*) c FROM topics").get().c, 16);
});

test("условие status=free не даёт двум клиентам занять один слот", () => {
  const book = db.prepare("UPDATE slots SET status='booked', client_request_id=? WHERE id=? AND status='free'");
  const first = book.run(1, 1);
  const second = book.run(2, 1);
  assert.equal(first.changes, 1, "первый занял слот");
  assert.equal(second.changes, 0, "второму слот не достался");
  assert.equal(db.prepare("SELECT client_request_id FROM slots WHERE id=1").get().client_request_id, 1);
});

test("освобождение слота возвращает его в общий доступ", () => {
  db.prepare("UPDATE slots SET status='free', client_request_id=NULL, is_intro_call=0 WHERE id=1").run();
  const slot = db.prepare("SELECT status, client_request_id FROM slots WHERE id=1").get();
  assert.equal(slot.status, "free");
  assert.equal(slot.client_request_id, null);
});

test("токен клиента уникален", () => {
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO client_requests (for_whom, name, phone, pd_consent, client_token) VALUES ('self','Дубль','+70000000004',1,'ca')",
        )
        .run(),
    /UNIQUE/,
  );
});
