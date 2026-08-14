// iCalendar: приглашение при брони и фид-подписка для психолога.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeed, buildIcs } from "../src/lib/ics.ts";

test("приглашение переводит московское время в UTC", () => {
  const ics = buildIcs({
    uid: "mipsy-slot-1@mipsy.mskacademy.ru",
    startsAt: "2026-08-20T15:00",
    durationMin: 50,
    summary: "Встреча",
    description: "Тест",
  });
  assert.match(ics, /DTSTART:20260820T120000Z/, "15:00 МСК = 12:00 UTC");
  assert.match(ics, /DTEND:20260820T125000Z/, "плюс 50 минут");
  assert.match(ics, /METHOD:REQUEST/);
  assert.ok(ics.endsWith("\r\n"), "строки по RFC разделяются CRLF");
});

test("фид собирает несколько событий и экранирует текст", () => {
  const feed = buildFeed({
    name: "mipsy — встречи",
    events: [
      {
        uid: "mipsy-slot-1@mipsy.mskacademy.ru",
        startsAt: "2026-08-20T15:00",
        durationMin: 50,
        summary: "Сессия: Анна, первая; встреча",
        description: "Кабинет",
      },
      {
        uid: "mipsy-slot-2@mipsy.mskacademy.ru",
        startsAt: "2026-08-21T10:00",
        durationMin: 50,
        summary: "Сессия: Борис",
        description: "Кабинет",
      },
    ],
  });

  assert.match(feed, /METHOD:PUBLISH/, "подписка, а не приглашение");
  assert.match(feed, /X-WR-CALNAME:mipsy — встречи/);
  assert.equal(feed.match(/BEGIN:VEVENT/g)?.length, 2);
  assert.match(feed, /UID:mipsy-slot-1@/);
  assert.match(feed, /UID:mipsy-slot-2@/);
  assert.match(feed, /SUMMARY:Сессия: Анна\\, первая\\; встреча/, "запятая и точка с запятой экранированы");
});

test("пустой фид — валидный календарь без событий", () => {
  const feed = buildFeed({ name: "mipsy", events: [] });
  assert.match(feed, /BEGIN:VCALENDAR/);
  assert.match(feed, /END:VCALENDAR/);
  assert.equal(feed.match(/BEGIN:VEVENT/g), null);
});
