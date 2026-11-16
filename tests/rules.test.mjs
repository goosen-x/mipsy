// Правила, от которых зависит безопасность клиента и целостность платформы.
// Импортируем настоящий код: раньше тест проверял свою копию правил,
// и изменение src его бы не сломало.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containsContacts,
  isCrisisAnswer,
  isValidPhone,
  phoneProblem,
  normalizePhone,
  publicProfileText,
} from "../src/lib/rules.ts";
import { GRADES, gradePriceLabel, gradeTitle, isGrade } from "../src/lib/grades.ts";

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

test("цена сессии определяется грейдом, без грейда цены нет", () => {
  assert.equal(Object.keys(GRADES).length, 3, "ровно три грейда");
  assert.equal(gradePriceLabel(2), `${GRADES[2].price.toLocaleString("ru-RU")} ₽`);
  assert.equal(gradeTitle(3), "Ведущий");
  assert.equal(gradePriceLabel(null), null, "грейд не присвоен — цена «уточняется»");
  assert.equal(gradePriceLabel(7), null, "мусорный грейд не даёт цену");
  assert.equal(isGrade(0), false);
});

test("телефон нормализуется и проверяется по длине", () => {
  assert.equal(normalizePhone("+7 (900) 123-45-67"), "+79001234567");
  assert.equal(isValidPhone("+7 (900) 123-45-67"), true);
  assert.equal(isValidPhone("123"), false);
  assert.equal(isValidPhone(""), false);
  assert.equal(isValidPhone(null), false);
  // Буквы и обрывки номера не проходят — раньше хватало «десяти цифр где угодно».
  assert.equal(isValidPhone("abc"), false);
  assert.equal(isValidPhone("+7 900 123-45-6x"), false);
  assert.equal(isValidPhone("1234567890abc"), false);
  assert.equal(isValidPhone("+7 123"), false);
  // Российский номер без +7 и зарубежный номер — валидны и нормализуются.
  assert.equal(normalizePhone("8 900 123-45-67"), "+79001234567");
  assert.equal(isValidPhone("+49 151 23456789"), true);
  assert.equal(normalizePhone("+49 151 23456789"), "+4915123456789");
  // Подсказка под полем различает «мало» и «много» цифр.
  assert.equal(phoneProblem("+7 900 123-45-67"), null);
  assert.equal(phoneProblem("+7 900 123"), "Не хватает цифр");
  assert.equal(phoneProblem("+7 99999999999"), "Лишние цифры — проверьте номер");
  assert.equal(phoneProblem("+7 000 123-45-67"), "Такого номера не бывает — проверьте код оператора");
});
