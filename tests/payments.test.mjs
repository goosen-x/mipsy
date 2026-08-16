import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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
