import { test } from "node:test";
import assert from "node:assert/strict";
import { canClientChange, formatSlot, isPast, mskPlusHours, nowMsk } from "../src/lib/datetime.ts";

test("nowMsk переводит UTC в московское время", () => {
  // 2026-08-12T10:00Z = 13:00 МСК
  assert.equal(nowMsk(new Date("2026-08-12T10:00:00Z")), "2026-08-12T13:00");
  // переход через полночь: 22:30Z = 01:30 следующего дня
  assert.equal(nowMsk(new Date("2026-08-12T22:30:00Z")), "2026-08-13T01:30");
});

test("isPast сравнивает с московским временем, а не с временем сервера", () => {
  const now = new Date("2026-08-12T10:00:00Z"); // 13:00 МСК
  assert.equal(isPast("2026-08-12T12:00", now), true);
  assert.equal(isPast("2026-08-12T14:00", now), false);
});

test("mskPlusHours не ломается на границе суток", () => {
  assert.equal(mskPlusHours(24, new Date("2026-08-12T10:00:00Z")), "2026-08-13T13:00");
});

test("клиент может менять встречу не позднее чем за 24 часа", () => {
  const now = new Date("2026-08-12T10:00:00Z"); // 13:00 МСК
  assert.equal(canClientChange("2026-08-13T14:00", now), true, "через 25 часов — можно");
  assert.equal(canClientChange("2026-08-13T12:00", now), false, "через 23 часа — нельзя");
  assert.equal(canClientChange("2026-08-12T18:00", now), false, "сегодня вечером — нельзя");
});

test("formatSlot показывает дату по-русски и помечает пояс", () => {
  assert.equal(formatSlot("2026-08-14T19:00"), "14 августа, пятница, 19:00 МСК");
});
