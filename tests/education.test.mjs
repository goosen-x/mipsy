// Образование психолога по полям (как на hh.ru): очистка присланного формой
// и текстовая версия для профиля. Импортируем настоящий код из src.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEducation, educationText } from "../src/lib/education.ts";

const NOW = new Date("2026-11-10T12:00:00Z");

test("без места учёбы сохранить нельзя", () => {
  assert.equal(cleanEducation({ places: [], courses: [] }, NOW).ok, false);
  assert.equal(cleanEducation({ places: [{ institution: "   " }] }, NOW).ok, false);
  assert.equal(cleanEducation(null, NOW).ok, false);
});

test("строки обрезаются, пустые записи выбрасываются, мусор чистится", () => {
  const res = cleanEducation(
    {
      places: [
        { level: "Высшее", institution: "  МГУ  ", institutionId: "39144", faculty: "Факультет психологии", specialization: "Психология", year: "2015" },
        { institution: "" },
        { level: "Взломщик", institution: "СПбГУ", institutionId: "<script>", year: 1700 },
      ],
      courses: [
        { name: "КПТ, полный курс", organization: "Институт Бека", hours: "520", year: 2018 },
        { name: "", organization: "пусто" },
        { name: "Схема-терапия", hours: -5, year: 2099 },
      ],
    },
    NOW,
  );
  assert.equal(res.ok, true);
  const { places, courses } = res.data;
  assert.equal(places.length, 2);
  assert.deepEqual(places[0], {
    level: "Высшее",
    institution: "МГУ",
    institutionId: "39144",
    faculty: "Факультет психологии",
    specialization: "Психология",
    year: 2015,
  });
  // Неизвестный уровень → «Высшее», чужой id и невозможный год — выброшены.
  assert.equal(places[1].level, "Высшее");
  assert.equal(places[1].institutionId, null);
  assert.equal(places[1].year, null);
  assert.equal(courses.length, 2);
  assert.equal(courses[0].hours, 520);
  assert.equal(courses[1].hours, null);
  assert.equal(courses[1].year, null);
});

test("год окончания может быть в будущем — человек ещё учится", () => {
  const res = cleanEducation({ places: [{ institution: "МГППУ", year: 2029 }] }, NOW);
  assert.equal(res.ok && res.data.places[0].year, 2029);
});

test("текстовая версия для профиля читается по-человечески", () => {
  const text = educationText({
    places: [
      { level: "Высшее", institution: "МГУ", institutionId: "39144", faculty: "Факультет психологии", specialization: "Психология", year: 2015 },
    ],
    courses: [{ name: "КПТ, полный курс", organization: "Институт Бека", hours: 520, year: 2018 }],
  });
  assert.equal(
    text,
    "МГУ — Факультет психологии, Психология — Высшее, 2015\nКПТ, полный курс — Институт Бека — 520 ч, 2018",
  );
});
