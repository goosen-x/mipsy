// Жизненный цикл слота через src/lib/booking.ts — тот же код, что зовут
// кабинеты клиента, психолога и оператора. База настоящая, время фиксировано.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import {
  bookSlotForRequest,
  cancelClientBooking,
  chosenPsychologist,
  freeBookedSlotsOf,
  markOutcome,
  openSlots,
  releaseSlot,
  removePsySlot,
  rescheduleClientBooking,
  takeSlot,
} from "../src/lib/booking.ts";

// 12:00 МСК 13 августа 2026 — все слоты в тестах отсчитываются от этой точки.
const NOW = new Date("2026-08-13T09:00:00Z");
const PAST = "2026-08-13T10:00"; // уже прошло
const SOON = "2026-08-13T20:00"; // ближе 24 часов
const FUTURE = "2026-08-20T15:00"; // далеко впереди
const FUTURE2 = "2026-08-21T15:00";

let dir;
let sqlite;
let db;
let psy1; // с постоянной ссылкой на видеовстречу
let psy2;

function addSlot(psyId, startsAt, extra = {}) {
  const { status = "free", clientRequestId = null, isIntroCall = 0, meetingLink = null } = extra;
  return Number(
    sqlite
      .prepare(
        "INSERT INTO slots (psychologist_id, starts_at, duration_min, status, client_request_id, is_intro_call, meeting_link) VALUES (?,?,50,?,?,?,?)",
      )
      .run(psyId, startsAt, status, clientRequestId, isIntroCall, meetingLink).lastInsertRowid,
  );
}

const slotById = (id) => sqlite.prepare("SELECT * FROM slots WHERE id = ?").get(id);

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-slots-"));
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
        "INSERT INTO psychologists (cabinet_token, slug, name, phone, email, moderation_status, meeting_url) VALUES ('t1','anna-1','Анна','+70000000001','anna@example.com','approved','https://telemost.example/anna')",
      )
      .run().lastInsertRowid,
  );
  psy2 = Number(
    sqlite
      .prepare(
        "INSERT INTO psychologists (cabinet_token, slug, name, phone, moderation_status) VALUES ('t2','boris-2','Борис','+70000000002','approved')",
      )
      .run().lastInsertRowid,
  );
  sqlite
    .prepare("INSERT INTO client_requests (for_whom, name, email, pd_consent, client_token) VALUES ('self','Клиент А','a@example.com',1,'ca')")
    .run();
  sqlite
    .prepare("INSERT INTO client_requests (for_whom, name, email, pd_consent, client_token) VALUES ('self','Клиент Б','b@example.com',1,'cb')")
    .run();
});

after(() => {
  sqlite?.close();
  rmSync(dir, { recursive: true, force: true });
});

// --- открытие окон психологом ---

test("openSlots открывает окна с повтором по неделям и не дублирует", async () => {
  const first = await openSlots(db, {
    psychologistId: psy2,
    date: "2026-09-07",
    times: ["10:00", "11:00"],
    durationMin: 50,
    isIntroCall: false,
    repeatWeeks: 2,
    now: NOW,
  });
  assert.deepEqual(first, { ok: true, added: 4 });

  const again = await openSlots(db, {
    psychologistId: psy2,
    date: "2026-09-07",
    times: ["10:00", "11:00"],
    durationMin: 50,
    isIntroCall: false,
    repeatWeeks: 2,
    now: NOW,
  });
  assert.deepEqual(again, { ok: true, added: 0 }, "повторный вызов ничего не плодит");
});

test("openSlots не открывает окна в прошлом", async () => {
  const res = await openSlots(db, {
    psychologistId: psy2,
    date: "2026-08-13",
    times: ["09:00", "23:00"], // 09:00 уже прошло (сейчас 12:00 МСК)
    durationMin: 50,
    isIntroCall: false,
    repeatWeeks: 1,
    now: NOW,
  });
  assert.deepEqual(res, { ok: true, added: 1 }, "прошедшее время молча пропущено");
});

test("openSlots отвергает мусорные дату и времена", async () => {
  const badDate = await openSlots(db, {
    psychologistId: psy2, date: "07.09.2026", times: ["10:00"],
    durationMin: 50, isIntroCall: false, repeatWeeks: 1, now: NOW,
  });
  assert.equal(badDate.ok, false);
  const badTimes = await openSlots(db, {
    psychologistId: psy2, date: "2026-09-07", times: ["25:99", "abc"],
    durationMin: 50, isIntroCall: false, repeatWeeks: 1, now: NOW,
  });
  assert.equal(badTimes.ok, false);
});

// --- бронь ---

test("takeSlot бронирует свободное окно и записывает ссылку на встречу", async () => {
  const slotId = addSlot(psy1, FUTURE);
  const psy = { id: psy1, name: "Анна", phone: "+70000000001", email: null, meetingUrl: "https://telemost.example/anna" };

  const res = await takeSlot(db, { slotId, psychologist: psy, clientRequestId: 1, now: NOW });
  assert.equal(res.ok, true);

  const row = slotById(slotId);
  assert.equal(row.status, "booked");
  assert.equal(row.client_request_id, 1);
  assert.equal(row.meeting_link, "https://telemost.example/anna");
});

test("второй клиент не может занять то же окно", async () => {
  const slotId = addSlot(psy1, FUTURE);
  const psy = { id: psy1, name: "Анна", phone: "", email: null, meetingUrl: null };

  const first = await takeSlot(db, { slotId, psychologist: psy, clientRequestId: 1, now: NOW });
  assert.equal(first.ok, true);
  const second = await takeSlot(db, { slotId, psychologist: psy, clientRequestId: 2, now: NOW });
  assert.equal(second.ok, false);
  assert.equal(slotById(slotId).client_request_id, 1, "окно осталось за первым");
});

test("нельзя занять чужое или прошедшее окно", async () => {
  const foreign = addSlot(psy2, FUTURE);
  const psy = { id: psy1, name: "Анна", phone: "", email: null, meetingUrl: null };
  const wrongPsy = await takeSlot(db, { slotId: foreign, psychologist: psy, clientRequestId: 1, now: NOW });
  assert.equal(wrongPsy.ok, false, "окно другого специалиста");

  const past = addSlot(psy1, PAST);
  const tooLate = await takeSlot(db, { slotId: past, psychologist: psy, clientRequestId: 1, now: NOW });
  assert.equal(tooLate.ok, false, "время уже прошло");
  assert.equal(slotById(past).status, "free");
});

test("бронь оператором тоже даёт клиенту ссылку на встречу", async () => {
  // Регресс: раньше bookSlotForClient не записывал meeting_link,
  // и клиент, записанный по телефону, не видел ссылку в кабинете.
  const slotId = addSlot(psy1, FUTURE);
  const res = await bookSlotForRequest(db, { slotId, clientRequestId: 2, now: NOW });
  assert.equal(res.ok, true);
  const row = slotById(slotId);
  assert.equal(row.meeting_link, "https://telemost.example/anna");
  assert.equal(row.client_request_id, 2);

  const pastId = addSlot(psy1, PAST);
  const tooLate = await bookSlotForRequest(db, { slotId: pastId, clientRequestId: 2, now: NOW });
  assert.equal(tooLate.ok, false, "оператор тоже не может записать в прошлое");
});

// --- освобождение ---

test("releaseSlot стирает всё клиентское, включая ссылку", async () => {
  const slotId = addSlot(psy1, FUTURE, {
    status: "booked", clientRequestId: 1, isIntroCall: 1, meetingLink: "https://telemost.example/anna",
  });
  await releaseSlot(db, slotId);
  const row = slotById(slotId);
  assert.equal(row.status, "free");
  assert.equal(row.client_request_id, null);
  assert.equal(row.is_intro_call, 0);
  assert.equal(row.meeting_link, null, "чужая ссылка не достанется следующему");
});

// --- отмена клиентом ---

test("клиент отменяет свою встречу не позднее чем за 24 часа", async () => {
  const slotId = addSlot(psy1, FUTURE, { status: "booked", clientRequestId: 1 });

  const foreign = await cancelClientBooking(db, { slotId, requestIds: [2], now: NOW });
  assert.equal(foreign.ok, false, "чужую запись не видно и не отменить");

  const ok = await cancelClientBooking(db, { slotId, requestIds: [1], now: NOW });
  assert.equal(ok.ok, true);
  assert.equal(ok.late, false, "за сутки — свободная отмена");
  assert.equal(ok.psy.name, "Анна", "есть кого предупредить об отмене");
  assert.equal(slotById(slotId).status, "free");
});

test("ближе суток отмена — только с подтверждением удержания", async () => {
  const slotId = addSlot(psy1, SOON, { status: "booked", clientRequestId: 1 });

  const refused = await cancelClientBooking(db, { slotId, requestIds: [1], now: NOW });
  assert.equal(refused.ok, false, "без подтверждения не проходит и при прямом вызове");
  assert.match(refused.error, /удерживается/);
  assert.equal(slotById(slotId).status, "booked", "запись на месте");

  const late = await cancelClientBooking(db, { slotId, requestIds: [1], allowLate: true, now: NOW });
  assert.equal(late.ok, true);
  assert.equal(late.late, true, "помечена поздней — психолог узнает про удержание");
  assert.equal(slotById(slotId).status, "free");
});

test("состоявшуюся встречу отменить нельзя", async () => {
  const slotId = addSlot(psy1, FUTURE, { status: "done", clientRequestId: 1 });
  const res = await cancelClientBooking(db, { slotId, requestIds: [1], now: NOW });
  assert.equal(res.ok, false);
});

// --- перенос ---

test("перенос: новое окно занято, старое вычищено", async () => {
  const from = addSlot(psy1, FUTURE, {
    status: "booked", clientRequestId: 1, isIntroCall: 1, meetingLink: "https://telemost.example/anna",
  });
  const to = addSlot(psy1, FUTURE2);

  const res = await rescheduleClientBooking(db, { fromSlotId: from, toSlotId: to, requestIds: [1], now: NOW });
  assert.equal(res.ok, true);

  const moved = slotById(to);
  assert.equal(moved.status, "booked");
  assert.equal(moved.client_request_id, 1);
  assert.equal(moved.is_intro_call, 1, "первая встреча осталась первой");
  assert.equal(moved.meeting_link, "https://telemost.example/anna");

  const old = slotById(from);
  assert.equal(old.status, "free");
  assert.equal(old.client_request_id, null);
  assert.equal(old.meeting_link, null);
});

test("перенос к другому специалисту невозможен", async () => {
  const from = addSlot(psy1, FUTURE, { status: "booked", clientRequestId: 1 });
  const to = addSlot(psy2, FUTURE2);

  const res = await rescheduleClientBooking(db, { fromSlotId: from, toSlotId: to, requestIds: [1], now: NOW });
  assert.equal(res.ok, false);
  assert.equal(slotById(from).status, "booked", "старая запись не потеряна");
  assert.equal(slotById(to).status, "free");
});

test("перенос ближе суток — только с подтверждением удержания", async () => {
  const from = addSlot(psy1, SOON, { status: "booked", clientRequestId: 1 });
  const to = addSlot(psy1, FUTURE2);

  const refused = await rescheduleClientBooking(db, { fromSlotId: from, toSlotId: to, requestIds: [1], now: NOW });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /удерживается/);
  assert.equal(slotById(to).status, "free", "новое окно не занято");

  const late = await rescheduleClientBooking(db, {
    fromSlotId: from,
    toSlotId: to,
    requestIds: [1],
    allowLate: true,
    now: NOW,
  });
  assert.equal(late.ok, true);
  assert.equal(late.late, true);
  assert.equal(slotById(to).status, "booked");
  assert.equal(slotById(from).status, "free");
});

// --- переподбор ---

test("переподбор снимает все брони и говорит, кого предупредить", async () => {
  const req = Number(
    sqlite
      .prepare("INSERT INTO client_requests (for_whom, name, pd_consent, client_token) VALUES ('self','Клиент В',1,'cv')")
      .run().lastInsertRowid,
  );
  const s1 = addSlot(psy1, FUTURE, { status: "booked", clientRequestId: req });
  const s2 = addSlot(psy2, FUTURE2, { status: "booked", clientRequestId: req });

  const freed = await freeBookedSlotsOf(db, req);
  assert.equal(freed.length, 2);
  assert.deepEqual(freed.map((f) => f.psy.name).sort(), ["Анна", "Борис"]);
  assert.equal(slotById(s1).status, "free");
  assert.equal(slotById(s2).status, "free");
});

// --- исход встречи ---

test("исход отмечается только своей прошедшей брони и только один раз", async () => {
  const slotId = addSlot(psy1, PAST, { status: "booked", clientRequestId: 1 });

  const early = await markOutcome(db, { slotId, psychologistId: psy1, outcome: "done", now: new Date("2026-08-13T05:00:00Z") });
  assert.equal(early.ok, false, "встреча ещё не прошла");

  const foreign = await markOutcome(db, { slotId, psychologistId: psy2, outcome: "done", now: NOW });
  assert.equal(foreign.ok, false, "чужая встреча не видна");

  const done = await markOutcome(db, { slotId, psychologistId: psy1, outcome: "done", now: NOW });
  assert.equal(done.ok, true);
  assert.equal(done.slot.clientRequestId, 1, "есть кому предложить отзыв");
  assert.equal(slotById(slotId).status, "done");

  const twice = await markOutcome(db, { slotId, psychologistId: psy1, outcome: "no_show", now: NOW });
  assert.equal(twice.ok, false, "исход не переписать");
});

// --- удаление окна психологом ---

test("психолог удаляет только своё свободное окно", async () => {
  const free = addSlot(psy1, FUTURE);
  const booked = addSlot(psy1, FUTURE2, { status: "booked", clientRequestId: 1 });

  const foreign = await removePsySlot(db, { slotId: free, psychologistId: psy2 });
  assert.equal(foreign.ok, false);

  const taken = await removePsySlot(db, { slotId: booked, psychologistId: psy1 });
  assert.equal(taken.ok, false, "занятое окно трогать нельзя");

  const ok = await removePsySlot(db, { slotId: free, psychologistId: psy1 });
  assert.equal(ok.ok, true);
  assert.equal(slotById(free), undefined);
});

// --- выбранный специалист ---

test("chosenPsychologist возвращает только активного выбранного", async () => {
  sqlite.prepare("INSERT INTO matches (client_request_id, psychologist_id, active, chosen) VALUES (1, ?, 1, 0)").run(psy1);
  assert.equal(await chosenPsychologist(db, 1), null, "предложен, но не выбран");

  sqlite.prepare("UPDATE matches SET chosen = 1 WHERE client_request_id = 1").run();
  const chosen = await chosenPsychologist(db, 1);
  assert.equal(chosen.name, "Анна");

  sqlite.prepare("UPDATE matches SET active = 0 WHERE client_request_id = 1").run();
  assert.equal(await chosenPsychologist(db, 1), null, "деактивированный подбор не считается");
});
