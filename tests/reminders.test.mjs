// Отбор напоминаний за сутки: окно 20–24 часа, только брони, идемпотентность
// через очередь уведомлений.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mskPlusHours } from "../src/lib/datetime.ts";
import { dueReminders } from "../src/lib/reminders.ts";

const NOW = new Date("2026-08-13T09:00:00Z"); // 12:00 МСК

let dir;
let sqlite;
let db;
let psy1;
let req1;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-reminders-"));
  const dbPath = path.join(dir, "test.db");
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: "pipe",
  });
  sqlite = new Database(dbPath);
  db = drizzle(sqlite);
  psy1 = Number(
    sqlite
      .prepare(
        "INSERT INTO psychologists (cabinet_token, name, phone, moderation_status) VALUES ('r1','Анна','+70000000001','approved')",
      )
      .run().lastInsertRowid,
  );
  req1 = Number(
    sqlite
      .prepare(
        "INSERT INTO client_requests (for_whom, name, phone, pd_consent, client_token, status) VALUES ('self','Клиент','+70000000002',1,'rr1','matched')",
      )
      .run().lastInsertRowid,
  );
});

after(() => {
  sqlite?.close();
  rmSync(dir, { recursive: true, force: true });
});

function addSlot(startsAt, extra = {}) {
  const { status = "booked", clientRequestId = req1 } = extra;
  return Number(
    sqlite
      .prepare(
        "INSERT INTO slots (psychologist_id, starts_at, duration_min, status, client_request_id) VALUES (?,?,50,?,?)",
      )
      .run(psy1, startsAt, status, clientRequestId).lastInsertRowid,
  );
}

test("в отбор попадает только бронь в окне 20–24 часа", async () => {
  const due22 = addSlot(mskPlusHours(22, NOW));
  addSlot(mskPlusHours(30, NOW)); // слишком рано напоминать
  addSlot(mskPlusHours(10, NOW)); // записан недавно — подтверждение свежее
  addSlot(mskPlusHours(23, NOW), { status: "free", clientRequestId: null }); // не бронь

  const due = await dueReminders(db, NOW);
  assert.equal(due.length, 1);
  assert.equal(due[0].slotId, due22);
  assert.equal(due[0].psyName, "Анна");
  assert.equal(due[0].clientName, "Клиент");
});

test("слот с уже поставленным напоминанием не отбирается повторно", async () => {
  const first = await dueReminders(db, NOW);
  assert.equal(first.length, 1);
  sqlite
    .prepare(
      "INSERT INTO notifications (kind, recipient_role, recipient_name, recipient_phone, body, slot_id) VALUES ('reminder','client','Клиент','+70000000002','текст',?)",
    )
    .run(first[0].slotId);

  const second = await dueReminders(db, NOW);
  assert.equal(second.length, 0, "напоминание не дублируется");
});

test("опрос после встречи: только прошедшие брони без итога и без повторов", async () => {
  const { dueOutcomeSurveys } = await import("../src/lib/reminders.ts");
  const passed = addSlot(mskPlusHours(-30, NOW)); // прошла 30 часов назад, итог не отмечен
  addSlot(mskPlusHours(-10, NOW)); // прошла недавно — рано спрашивать
  addSlot(mskPlusHours(-120, NOW)); // старьё за окном
  addSlot(mskPlusHours(-31, NOW), { status: "done", clientRequestId: req1 }); // итог отмечен

  const due = await dueOutcomeSurveys(db, NOW);
  assert.equal(due.length, 1);
  assert.equal(due[0].slotId, passed);
  assert.equal(due[0].psyPhone, "+70000000001");

  sqlite
    .prepare(
      "INSERT INTO notifications (kind, recipient_role, recipient_name, recipient_phone, body, slot_id) VALUES ('review','client','Клиент','+70000000002','текст',?)",
    )
    .run(passed);
  assert.equal((await dueOutcomeSurveys(db, NOW)).length, 0, "опрос не дублируется");
});
