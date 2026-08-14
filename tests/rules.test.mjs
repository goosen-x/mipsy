// Правила, от которых зависит безопасность клиента и целостность платформы.
// Импортируем настоящий код: раньше тест проверял свою копию правил,
// и изменение src его бы не сломало.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containsContacts,
  isCrisisAnswer,
  isValidPhone,
  normalizePhone,
  publicProfileText,
} from "../src/lib/rules.ts";

test("кризисный флаг ставится от «несколько раз в месяц» и выше", () => {
  assert.equal(isCrisisAnswer("never"), false);
  assert.equal(isCrisisAnswer("seldom"), false);
  assert.equal(isCrisisAnswer("monthly"), true);
  assert.equal(isCrisisAnswer("weekly"), true);
  assert.equal(isCrisisAnswer("daily"), true);
  assert.equal(isCrisisAnswer(null), false);
});

test("фильтр ловит контакты в тексте профиля", () => {
  const bad = [
    "Пишите мне +7 900 123-45-67",
    "мой телеграм @anna_psy",
    "подробности t.me/annapsy",
    "инстаграм instagram.com/anna",
    "вотсап wa.me/79001234567",
  ];
  for (const text of bad) assert.ok(containsContacts(text), `не поймал: ${text}`);
});

test("фильтр не мешает нормальному тексту профиля", () => {
  const good = [
    "Работаю в КПТ-подходе с 2015 года, супервизия каждые две недели.",
    "Сессия длится 50 минут, встречаемся раз в неделю.",
    "Стоимость 3500 рублей.",
    "Обучение 560 часов, диплом 2017 года.",
  ];
  for (const text of good) assert.equal(containsContacts(text), false, `ложное срабатывание: ${text}`);
});

test("проверяются все публичные поля профиля, включая FAQ", () => {
  const profile = {
    about: "Работаю бережно.",
    howSessions: "50 минут онлайн.",
    approach: "КПТ",
    faq: [{ q: "Как связаться заранее?", a: "телеграм @anna_psy" }],
  };
  assert.ok(containsContacts(publicProfileText(profile)), "контакт спрятан в ответе FAQ");
  assert.equal(
    containsContacts(publicProfileText({ ...profile, faq: [] })),
    false,
    "без FAQ текст чистый",
  );
});

test("телефон нормализуется и проверяется по длине", () => {
  assert.equal(normalizePhone("+7 (900) 123-45-67"), "+79001234567");
  assert.equal(isValidPhone("+7 (900) 123-45-67"), true);
  assert.equal(isValidPhone("123"), false);
  assert.equal(isValidPhone(""), false);
  assert.equal(isValidPhone(null), false);
});
