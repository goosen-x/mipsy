// Расписание психолога: сессии разной длины (индивидуальная 50, парная 90),
// нарезка рабочих часов на период и пакетное сохранение на настоящей SQLite.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { mondayOf, overlaps, repeatWeeks, sessionsFromTemplate } from "../src/lib/schedule.ts";
import { applySchedule } from "../src/lib/booking.ts";

const NOW = new Date("2026-11-10T09:00:00Z"); // вторник, 12:00 МСК

test("90-минутная сессия пересекается со следующей через час, а через полтора — нет", () => {
  const pair = { startsAt: "2026-12-01T10:00", durationMin: 90 };
  assert.equal(overlaps(pair, { startsAt: "2026-12-01T11:00", durationMin: 50 }), true);
  assert.equal(overlaps(pair, { startsAt: "2026-12-01T11:30", durationMin: 50 }), false);
  // Сессия, начавшаяся раньше и ещё идущая, тоже пересекается.
  assert.equal(overlaps(pair, { startsAt: "2026-12-01T09:30", durationMin: 50 }), true);
});

test("понедельник недели считается и для воскресенья", () => {
  assert.equal(mondayOf("2026-11-10"), "2026-11-09");
  assert.equal(mondayOf("2026-11-15"), "2026-11-09");
  assert.equal(mondayOf("2026-11-16"), "2026-11-16");
});

test("рабочие часы нарезаются сессиями своего типа с перерывом, хвост отбрасывается", () => {
  const sessions = sessionsFromTemplate(
    {
      0: [{ from: "10:00", to: "13:00", minutes: 50 }], // пн: 10:00, 11:00, 12:00
      2: [{ from: "18:00", to: "21:30", minutes: 90 }], // ср: 18:00, 19:40 (до 21:10); 21:20 не влезает
    },
    { startDate: "2026-11-16", days: 7, breakMin: 10 },
  );
  assert.deepEqual(
    sessions.map((s) => `${s.startsAt}/${s.durationMin}`),
    ["2026-11-16T10:00/50", "2026-11-16T11:00/50", "2026-11-16T12:00/50", "2026-11-18T18:00/90", "2026-11-18T19:40/90"],
  );
});

test("повтор недели сдвигает сессии на 7 дней с сохранением длительности", () => {
  const out = repeatWeeks([{ startsAt: "2026-11-16T10:00", durationMin: 90 }], 2);
  assert.deepEqual(out, [
    { startsAt: "2026-11-23T10:00", durationMin: 90 },
    { startsAt: "2026-11-30T10:00", durationMin: 90 },
  ]);
});

let dir;
let sqlite;
let db;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-schedule-"));
  const dbPath = path.join(dir, "test.db");
  execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_PATH: dbPath }, stdio: "pipe" });
  sqlite = new Database(dbPath);
  db = drizzle(sqlite);
  sqlite
    .prepare("INSERT INTO psychologists (cabinet_token, slug, name, phone, moderation_status) VALUES ('t1','p-1','Тест','+70000000001','approved')")
    .run();
  sqlite
    .prepare("INSERT INTO client_requests (for_whom, name, phone, pd_consent, client_token) VALUES ('self','Клиент','+70000000002',1,'c1')")
    .run();
  // Запись клиента 1 декабря в 12:00 и свободное окно в 15:00.
  sqlite
    .prepare("INSERT INTO slots (psychologist_id, starts_at, duration_min, status, client_request_id) VALUES (1,'2026-12-01T12:00',50,'booked',1)")
    .run();
  sqlite.prepare("INSERT INTO slots (psychologist_id, starts_at, duration_min) VALUES (1,'2026-12-01T15:00',50)").run();
});

after(() => {
  sqlite?.close();
  rmSync(dir, { recursive: true, force: true });
});

const startsAt = () => sqlite.prepare("SELECT starts_at || '/' || duration_min AS s FROM slots ORDER BY starts_at").all().map((r) => r.s);

test("пакет: парная не встаёт поверх записи клиента, пересечения внутри пакета пропускаются", async () => {
  const res = await applySchedule(db, {
    psychologistId: 1,
    open: [
      { startsAt: "2026-12-01T11:00", durationMin: 90 }, // до 12:30 — налезает на запись в 12:00
      { startsAt: "2026-12-01T09:00", durationMin: 90 }, // 9:00–10:30 — ок
      { startsAt: "2026-12-01T10:00", durationMin: 50 }, // налезает на 9:00–10:30 из этого же пакета
      { startsAt: "2026-12-01T13:00", durationMin: 50 }, // ок
      { startsAt: "2026-11-01T10:00", durationMin: 50 }, // прошлое — пропуск
    ],
    closeIds: [],
    now: NOW,
  });
  assert.deepEqual(res, { ok: true, added: 2, removed: 0, skipped: 3 });
  assert.deepEqual(startsAt(), [
    "2026-12-01T09:00/90",
    "2026-12-01T12:00/50",
    "2026-12-01T13:00/50",
    "2026-12-01T15:00/50",
  ]);
});

test("пакет: закрываются только свободные окна, запись клиента остаётся", async () => {
  const ids = sqlite.prepare("SELECT id FROM slots").all().map((r) => r.id);
  const res = await applySchedule(db, { psychologistId: 1, open: [], closeIds: ids, now: NOW });
  assert.equal(res.ok, true);
  assert.equal(res.removed, 3);
  assert.deepEqual(startsAt(), ["2026-12-01T12:00/50"]);
});

test("пакет: чужие окна не закрываются", async () => {
  sqlite
    .prepare("INSERT INTO psychologists (cabinet_token, slug, name, phone, moderation_status) VALUES ('t2','p-2','Другой','+70000000003','approved')")
    .run();
  const other = sqlite.prepare("INSERT INTO slots (psychologist_id, starts_at, duration_min) VALUES (2,'2026-12-02T10:00',50)").run();
  const res = await applySchedule(db, { psychologistId: 1, open: [], closeIds: [Number(other.lastInsertRowid)], now: NOW });
  assert.equal(res.removed, 0);
});
