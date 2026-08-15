// Регресс-тесты аудита 15.08: гонки, валидация входа, каскады переподбора
// и снятия психолога. Каждый тест соответствует находке из отчёта.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import {
  cancelClientBooking,
  markOutcome,
  openSlots,
  rescheduleClientBooking,
  removePsySlot,
  setSlotPaid,
} from "../src/lib/booking.ts";
import { deactivateMatches, retirePsychologist } from "../src/lib/matching.ts";

const NOW = new Date("2026-08-13T09:00:00Z"); // 12:00 МСК
const PAST = "2026-08-13T10:30";
const FUTURE = "2026-09-10T15:00";

let dir;
let sqlite;
let db;
let psy1;

let seq = 0;
function addSlot(psyId, startsAt, extra = {}) {
  const { status = "free", clientRequestId = null, paidAt = null } = extra;
  const d = new Date(`${startsAt}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + (seq++ % 80));
  return Number(
    sqlite
      .prepare(
        "INSERT INTO slots (psychologist_id, starts_at, duration_min, status, client_request_id, paid_at) VALUES (?,?,50,?,?,?)",
      )
      .run(psyId, d.toISOString().slice(0, 16), status, clientRequestId, paidAt).lastInsertRowid,
  );
}
const slotById = (id) => sqlite.prepare("SELECT * FROM slots WHERE id = ?").get(id);

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-audit-"));
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
        "INSERT INTO psychologists (cabinet_token, name, phone, moderation_status) VALUES ('a1','Анна','+70000000001','approved')",
      )
      .run().lastInsertRowid,
  );
  sqlite
    .prepare("INSERT INTO client_requests (for_whom, name, pd_consent, client_token, status) VALUES ('self','Клиент',1,'r1','matched')")
    .run();
});

after(() => {
  sqlite?.close();
  rmSync(dir, { recursive: true, force: true });
});

test("двойной перенос одной брони не создаёт две встречи", async () => {
  const from = addSlot(psy1, FUTURE, { status: "booked", clientRequestId: 1, paidAt: "2026-08-13 10:00" });
  const toA = addSlot(psy1, FUTURE);
  const toB = addSlot(psy1, FUTURE);

  const [a, b] = await Promise.all([
    rescheduleClientBooking(db, { fromSlotId: from, toSlotId: toA, requestIds: [1], now: NOW }),
    rescheduleClientBooking(db, { fromSlotId: from, toSlotId: toB, requestIds: [1], now: NOW }),
  ]);

  assert.equal([a, b].filter((r) => r.ok).length, 1, "прошёл ровно один перенос");
  const booked = sqlite
    .prepare("SELECT count(*) c FROM slots WHERE client_request_id = 1 AND status = 'booked'")
    .get();
  assert.equal(booked.c, 1, "у клиента одна бронь, не две");
  const paid = sqlite
    .prepare("SELECT count(*) c FROM slots WHERE paid_at IS NOT NULL")
    .get();
  assert.equal(paid.c, 1, "оплата не размножилась");
});

test("отмена и перенос параллельно не дают «отменено, но записан»", async () => {
  const from = addSlot(psy1, FUTURE, { status: "booked", clientRequestId: 1 });
  const to = addSlot(psy1, FUTURE);

  const [c, r] = await Promise.all([
    cancelClientBooking(db, { slotId: from, requestIds: [1], now: NOW }),
    rescheduleClientBooking(db, { fromSlotId: from, toSlotId: to, requestIds: [1], now: NOW }),
  ]);

  assert.equal([c, r].filter((x) => x.ok).length, 1, "выигрывает ровно одна операция");
  const booked = sqlite
    .prepare("SELECT count(*) c FROM slots WHERE client_request_id = 1 AND status='booked' AND id IN (?,?)")
    .get(from, to);
  assert.ok(booked.c <= 1, "не больше одной живой брони");
});

test("исход встречи нельзя перезаписать параллельной отметкой", async () => {
  const slotId = addSlot(psy1, PAST, { status: "booked", clientRequestId: 1 });
  const [a, b] = await Promise.all([
    markOutcome(db, { slotId, psychologistId: psy1, outcome: "done", now: NOW }),
    markOutcome(db, { slotId, psychologistId: psy1, outcome: "no_show", now: NOW }),
  ]);
  assert.equal([a, b].filter((r) => r.ok).length, 1, "исход ставится один раз");
});

test("прошедшую бронь нельзя отменить или перенести даже с allowLate", async () => {
  const slotId = addSlot(psy1, PAST, { status: "booked", clientRequestId: 1 });
  const cancel = await cancelClientBooking(db, { slotId, requestIds: [1], allowLate: true, now: NOW });
  assert.equal(cancel.ok, false, "клиент не увернётся от неявки");
  assert.match(cancel.error, /уже прошла/);

  const to = addSlot(psy1, FUTURE);
  const move = await rescheduleClientBooking(db, {
    fromSlotId: slotId, toSlotId: to, requestIds: [1], allowLate: true, now: NOW,
  });
  assert.equal(move.ok, false);
  assert.equal(slotById(slotId).status, "booked", "бронь ждёт отметки специалиста");
});

test("openSlots отвергает несуществующие даты и дубли времён", async () => {
  const badMonth = await openSlots(db, {
    psychologistId: psy1, date: "2026-13-01", times: ["10:00"],
    durationMin: 50, isIntroCall: false, repeatWeeks: 1, now: NOW,
  });
  assert.equal(badMonth.ok, false, "13-й месяц не роняет экшен, а вежливо отклоняется");

  const badDay = await openSlots(db, {
    psychologistId: psy1, date: "2027-02-31", times: ["10:00"],
    durationMin: 50, isIntroCall: false, repeatWeeks: 1, now: NOW,
  });
  assert.equal(badDay.ok, false, "31 февраля не превращается молча в 3 марта");

  const dup = await openSlots(db, {
    psychologistId: psy1, date: "2027-03-01", times: ["10:00", "10:00", "10:00"],
    durationMin: 50, isIntroCall: false, repeatWeeks: 1, now: NOW,
  });
  assert.deepEqual(dup, { ok: true, added: 1 }, "три одинаковых времени = одно окно");

  const badDur = await openSlots(db, {
    psychologistId: psy1, date: "2027-03-02", times: ["10:00"],
    durationMin: -30, isIntroCall: false, repeatWeeks: 1, now: NOW,
  });
  assert.equal(badDur.ok, false, "отрицательная длительность отклонена");
});

test("параллельное открытие одинаковых окон не дублирует слоты", async () => {
  const params = {
    psychologistId: psy1, date: "2027-04-05", times: ["11:00", "12:00"],
    durationMin: 50, isIntroCall: false, repeatWeeks: 1, now: NOW,
  };
  const [a, b] = await Promise.all([openSlots(db, params), openSlots(db, params)]);
  assert.equal((a.added ?? 0) + (b.added ?? 0), 2, "два окна суммарно, без дублей");
  const rows = sqlite
    .prepare("SELECT count(*) c FROM slots WHERE psychologist_id = ? AND starts_at LIKE '2027-04-05%'")
    .get(psy1);
  assert.equal(rows.c, 2);
});

test("done-слот нельзя удалить — история сессий и отзывы целы", async () => {
  const slotId = addSlot(psy1, PAST, { status: "done", clientRequestId: 1 });
  sqlite
    .prepare("INSERT INTO reviews (psychologist_id, client_request_id, slot_id, rating, author_name) VALUES (?,1,?,5,'Клиент')")
    .run(psy1, slotId);

  const res = await removePsySlot(db, { slotId, psychologistId: psy1 });
  assert.equal(res.ok, false);
  assert.match(res.error, /история/);
  assert.ok(slotById(slotId), "слот на месте");
});

test("двойной отзыв об одной встрече блокируется схемой", () => {
  const slotId = addSlot(psy1, PAST, { status: "done", clientRequestId: 1 });
  const ins = sqlite.prepare(
    "INSERT INTO reviews (psychologist_id, client_request_id, slot_id, rating, author_name) VALUES (?,1,?,5,'Клиент')",
  );
  ins.run(psy1, slotId);
  assert.throws(() => ins.run(psy1, slotId), /UNIQUE/, "второй отзыв не проходит");
});

test("переподбор гасит все активные предложения", async () => {
  sqlite.prepare("INSERT INTO matches (client_request_id, psychologist_id, active, chosen) VALUES (1, ?, 1, 1)").run(psy1);
  await deactivateMatches(db, 1);
  const alive = sqlite.prepare("SELECT count(*) c FROM matches WHERE client_request_id = 1 AND active = 1").get();
  assert.equal(alive.c, 0, "выбранный психолог тоже снят");
});

test("снятие психолога с платформы уводит его клиентов на переподбор", async () => {
  const psy2 = Number(
    sqlite
      .prepare("INSERT INTO psychologists (cabinet_token, name, phone, moderation_status) VALUES ('a2','Борис','+70000000002','approved')")
      .run().lastInsertRowid,
  );
  const req = Number(
    sqlite
      .prepare("INSERT INTO client_requests (for_whom, name, pd_consent, client_token, status) VALUES ('self','Клиентка',1,'r2','matched')")
      .run().lastInsertRowid,
  );
  sqlite.prepare("INSERT INTO matches (client_request_id, psychologist_id, active, chosen) VALUES (?, ?, 1, 1)").run(req, psy2);
  const future = addSlot(psy2, FUTURE, { status: "booked", clientRequestId: req });
  const pastDone = addSlot(psy2, PAST, { status: "done", clientRequestId: req });

  const { clients } = await retirePsychologist(db, psy2, NOW);

  assert.equal(clients.length, 1);
  assert.equal(clients[0].requestId, req);
  assert.equal(slotById(future).status, "free", "будущая бронь освобождена");
  assert.equal(slotById(pastDone).status, "done", "история сессий не тронута");
  assert.equal(
    sqlite.prepare("SELECT count(*) c FROM matches WHERE psychologist_id = ? AND active = 1").get(psy2).c,
    0,
    "активных предложений не осталось",
  );
  assert.equal(
    sqlite.prepare("SELECT status FROM client_requests WHERE id = ?").get(req).status,
    "rematch",
    "заявка ушла в переподбор",
  );
});
