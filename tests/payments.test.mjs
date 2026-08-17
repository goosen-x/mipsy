import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { rescheduleClientBooking } from "../src/lib/booking.ts";
import { verifyCloudpaymentsHmac } from "../src/lib/payments.ts";

const SECRET = "test-api-secret";
const BODY = "TransactionId=1&InvoiceId=42&Amount=3500.00&Status=Completed&TestMode=1";
const sign = (body, secret) => createHmac("sha256", secret).update(body, "utf8").digest("base64");

test("подпись CloudPayments: верная проходит", () => {
  assert.equal(verifyCloudpaymentsHmac(BODY, sign(BODY, SECRET), SECRET), true);
});

test("подпись CloudPayments: чужой секрет и подменённое тело отклоняются", () => {
  assert.equal(verifyCloudpaymentsHmac(BODY, sign(BODY, "other-secret"), SECRET), false);
  const tampered = BODY.replace("Amount=3500.00", "Amount=1.00");
  assert.equal(verifyCloudpaymentsHmac(tampered, sign(BODY, SECRET), SECRET), false);
});

test("подпись CloudPayments: без заголовка и с мусором — отказ", () => {
  assert.equal(verifyCloudpaymentsHmac(BODY, null, SECRET), false);
  assert.equal(verifyCloudpaymentsHmac(BODY, "не base64 вовсе!!!", SECRET), false);
});

// Платёж и перенос встречи: строка payments должна ехать за сессией на новый
// слот, иначе реестр /admin/payments примет перенос за отмену.

const NOW = new Date("2026-08-13T09:00:00Z");
const FUTURE = "2026-09-10T15:00";

let dir;
let sqlite;
let db;
let psy1;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mipsy-payments-"));
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
        "INSERT INTO psychologists (cabinet_token, name, phone, moderation_status) VALUES ('p1','Анна','+70000000001','approved')",
      )
      .run().lastInsertRowid,
  );
});

after(() => {
  sqlite?.close();
  rmSync(dir, { recursive: true, force: true });
});

function addAccount(email) {
  return Number(
    sqlite.prepare("INSERT INTO accounts (email, name) VALUES (?, 'Клиент')").run(email)
      .lastInsertRowid,
  );
}

function addRequest(accountId, token) {
  return Number(
    sqlite
      .prepare(
        "INSERT INTO client_requests (for_whom, name, pd_consent, client_token, status, account_id) VALUES ('self','Клиент',1,?,'matched',?)",
      )
      .run(token, accountId).lastInsertRowid,
  );
}

function addSlot(startsAt, extra = {}) {
  const { status = "free", clientRequestId = null, paidAt = null } = extra;
  return Number(
    sqlite
      .prepare(
        "INSERT INTO slots (psychologist_id, starts_at, duration_min, status, client_request_id, paid_at) VALUES (?,?,50,?,?,?)",
      )
      .run(psy1, startsAt, status, clientRequestId, paidAt).lastInsertRowid,
  );
}

function addPayment(slotId, accountId) {
  return Number(
    sqlite
      .prepare(
        "INSERT INTO payments (slot_id, account_id, amount, provider, status) VALUES (?,?,3500,'yookassa','succeeded')",
      )
      .run(slotId, accountId).lastInsertRowid,
  );
}

const paymentSlot = (id) =>
  sqlite.prepare("SELECT slot_id FROM payments WHERE id = ?").get(id).slot_id;

test("перенос встречи уводит платёж на новый слот", async () => {
  const acc = addAccount("payer@example.com");
  const req = addRequest(acc, "pr1");
  const from = addSlot(FUTURE, { status: "booked", clientRequestId: req, paidAt: "2026-08-13 10:00" });
  const to = addSlot("2026-09-11T15:00");
  const paymentId = addPayment(from, acc);

  const res = await rescheduleClientBooking(db, {
    fromSlotId: from, toSlotId: to, requestIds: [req], now: NOW,
  });
  assert.equal(res.ok, true);
  assert.equal(paymentSlot(paymentId), to, "платёж уехал вместе с сессией");
});

test("чужой платёж прежней брони этого окна остаётся на месте", async () => {
  const other = addAccount("former@example.com");
  const acc = addAccount("payer2@example.com");
  const req = addRequest(acc, "pr2");
  // Окно когда-то бронировал и оплачивал другой клиент, потом отменил.
  const from = addSlot("2026-09-12T15:00", { status: "booked", clientRequestId: req });
  const to = addSlot("2026-09-13T15:00");
  const stale = addPayment(from, other);
  const own = addPayment(from, acc);

  const res = await rescheduleClientBooking(db, {
    fromSlotId: from, toSlotId: to, requestIds: [req], now: NOW,
  });
  assert.equal(res.ok, true);
  assert.equal(paymentSlot(own), to, "свой платёж переехал");
  assert.equal(paymentSlot(stale), from, "платёж прежнего клиента не тронут");
});
