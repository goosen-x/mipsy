// Правила, от которых зависит безопасность клиента и целостность платформы.
import { test } from "node:test";
import assert from "node:assert/strict";

// Дублирует условие из src/app/anketa/actions.ts
const FREQ = ["never", "seldom", "monthly", "weekly", "daily"];
const isCrisis = (answer) => !!answer && FREQ.indexOf(answer) >= FREQ.indexOf("monthly");

// Дублирует фильтр из src/app/cab/[token]/profile-form.tsx
const CONTACT_RE = /(\+?\d[\d\s\-()]{8,})|@\w{2,}|(t\.me|wa\.me|vk\.com|instagram\.com)/i;

test("кризисный флаг ставится от «несколько раз в месяц» и выше", () => {
  assert.equal(isCrisis("never"), false);
  assert.equal(isCrisis("seldom"), false);
  assert.equal(isCrisis("monthly"), true);
  assert.equal(isCrisis("weekly"), true);
  assert.equal(isCrisis("daily"), true);
  assert.equal(isCrisis(null), false);
});

test("фильтр ловит контакты в тексте профиля", () => {
  const bad = [
    "Пишите мне +7 900 123-45-67",
    "мой телеграм @anna_psy",
    "подробности t.me/annapsy",
    "инстаграм instagram.com/anna",
    "вотсап wa.me/79001234567",
  ];
  for (const text of bad) assert.ok(CONTACT_RE.test(text), `не поймал: ${text}`);
});

test("фильтр не мешает нормальному тексту профиля", () => {
  const good = [
    "Работаю в КПТ-подходе с 2015 года, супервизия каждые две недели.",
    "Сессия длится 50 минут, встречаемся раз в неделю.",
    "Стоимость 3500 рублей.",
    "Обучение 560 часов, диплом 2017 года.",
  ];
  for (const text of good) assert.equal(CONTACT_RE.test(text), false, `ложное срабатывание: ${text}`);
});

test("телефон нормализуется и проверяется по длине", () => {
  const normalize = (p) => (p ?? "").replace(/[^\d+]/g, "");
  const valid = (p) => normalize(p).replace(/\D/g, "").length >= 10;
  assert.equal(valid("+7 (900) 123-45-67"), true);
  assert.equal(normalize("+7 (900) 123-45-67"), "+79001234567");
  assert.equal(valid("123"), false);
  assert.equal(valid(""), false);
});
