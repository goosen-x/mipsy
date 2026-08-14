# Слоты и внешние календари: разбор референсов

Снято 2026-08-13 с официальных справок платформ, кода Cal.com (github.com/calcom/cal.com, ветка main), доков Google Calendar API, RFC 4791/6578 и справок Яндекса/Apple. Материал для решения «как психологу mipsy жить одновременно в /cab и в своём Google/Яндекс/Apple-календаре».

Контекст mipsy: слот — единственный источник правды (`src/db/schema.ts`, таблица `slots`; `startsAt` — строка `"YYYY-MM-DDTHH:mm"` в МСК), психолог открывает окна вручную (`openSlots` в `src/lib/booking.ts`: дата + времена + повтор до 8 недель), клиенту при брони уходит письмо с вложением `.ics` (`meetingInvite` в `src/lib/notify.ts`) и есть роут «добавить в календарь» `/api/ics`. Психологу при брони уходит только текст, без `.ics`. Фоновых воркеров и крона нет, деплой — один контейнер, база — SQLite.

## Словарь моделей

1. **Ручные слоты** — окна открываются только в кабинете платформы; внешний календарь платформа не видит (наш текущий вариант).
2. **ICS-фид (экспорт)** — платформа отдаёт приватный URL с календарём броней; психолог подписывается на него из Google/Яндекс/Apple. Однонаправленно, платформа ничего не читает.
3. **Busy-check** — окна по-прежнему задаются на платформе, но перед показом/бронью платформа читает занятость внешнего календаря и вычитает её из открытых окон.
4. **Двусторонняя синхра** — платформа и читает внешний календарь, и пишет в него события, и реагирует на изменения (webhooks/watch).

## Российские платформы

Главный вывод: **стандарт российского рынка — ручные слоты без всякой синхронизации**. Единственное найденное упоминание интеграции с внешним календарём — у Zigmund.Online. Публичных help-центров для специалистов нет ни у кого (всё за логином), поэтому конфликт-логика нигде извне не проверяется.

| Платформа | Модель | Внешний календарь | Уведомление психологу о брони |
|---|---|---|---|
| Zigmund.Online | ручные слоты (часы/дни, выходные, отпуск) | заявлена интеграция с Google Календарём, механика не раскрыта | не описано |
| Alter | ручные слоты + клиент может предложить своё время (косвенно) | не найдено | email + Telegram |
| Ясно | ручные слоты; нет слотов → чат со специалистом | не найдено | не найдено |
| SmartMental | слотов нет: заявка через общую форму GetCourse | не найдено | не найдено |
| PsyPsy | слотов нет: специалист сам связывается и договаривается | не найдено | не найдено |
| B17 | слотов нет: заявка/переписка (косвенно) | не найдено | пуш о запросах в приложении (косвенно) |
| Profi.ru | лидогенерация: отклик на заказ, время в чате | не найдено | пуш о заказах/сообщениях (косвенно) |

Подробности и источники:

- **Zigmund.Online** — дословно со страницы для психологов (https://main.zigmund.online/psiholog): «Отмечайте в нём часы и дни, когда готовы консультировать, выходные и даты отпуска. Клиенты смогут записаться только в доступные интервалы» и «Календарь Zigmund.Online можно интегрировать с „Google Календарём" и назначать там задачи, супервизии и сессии, которые у вас есть вне сервиса». Направление синхры (экспорт/чтение/двусторонняя) не раскрыто; Яндекс/Apple/ICS не упоминаются. При отпуске психолог сам удаляет свободные слоты — ответственность за актуальность на специалисте. Справочного центра help.zigmund.online не существует (домен не отвечает).
- **Alter** — «вы можете записывать клиентов на сессии… вести своё расписание», психолог «получает уведомление о новой записи, переносах и отменах… по электронной почте (email) и в мессенджере „Telegram"» (https://alter.ru/for-psychologists). Про интеграцию календарей — ничего ни там, ни в FAQ (https://alter.ru/faq). Клиентское правило: отмена/перенос за 24 часа.
- **Ясно** — «удобный личный кабинет с расписанием» (https://work.yasno.live/psychologist); из клиентского FAQ (https://yasno.live/faq): перенос — если до сессии больше 12 часов и есть свободный слот, «если у специалиста нет свободных слотов — напишите ему в чате». Календарных интеграций не найдено.
- **SmartMental** — кнопки «Выбрать время сессии» в каталоге (https://catalog.smart-mental.ru/catalog) ведут на единую форму заявки GetCourse, одинаковую для всех специалистов, — календаря психолога с этой стороны нет. Упоминание YCLIENTS в выдаче не подтвердилось.
- **PsyPsy** — «специалист изучит вашу анкету и сам свяжется с вами, чтобы договориться о времени первой сессии» (https://psypsy.online/); перенос — через персонального менеджера.
- **B17** — публичного календаря слотов нет, запись через форму/переписку (сторонний обзор https://psyhologi-b17.orgs.biz/ — косвенно; сам b17.ru отдавал 429 на выкачку). Приложение шлёт уведомления о запросах на консультацию (описание в Google Play — косвенно).
- **Profi.ru** — заказ → платный отклик → время в чате (https://apps.apple.com/ru/app/для-профи/id1449145755, отзывы специалистов на otzovik.com — косвенно). Упоминание «настройки расписания» в кабинете есть только в стороннем обзоре (toolfox.ru — косвенно), деталей нет.

## Эталоны букинга

Все шесть сервисов используют **одну и ту же трёхчастную модель**: (1) availability задаётся внутри сервиса (рабочие часы/окна), (2) подключённые календари — только источник busy-интервалов, (3) новая бронь пушится в календарь через API провайдера, а участнику уходит письмо с `.ics`. **Никто не строит доступность «из календаря»** — календарь только вычитает время. События со статусом Free/Transparent игнорируются везде, где это документировано. Исходящий ICS-фид «подписка на мои брони» не документирован ни у одного из шести.

| Сервис | Провайдеры | Busy-check | Бронь в календарь |
|---|---|---|---|
| Calendly | Google, O365/Outlook, Exchange | до 6 календарей на конфликты, «Free» игнорируется | автосоздание в одном «add to calendar»-календаре + email с `calendar.ics` |
| Cal.com | Google, O365, iCloud/CalDAV, generic CalDAV, Exchange (EWS), **входящий ICS-фид**, Zoho и др. | Google `freebusy.query` (чанки по 90 дней), CalDAV через tsdav; кэш + webhooks | `EventManager` → create event API + письма с ICS-вложением |
| Acuity | Google, Outlook/O365/Exchange, iCloud | опция «block off time» из внешнего календаря | двусторонний API-sync событий |
| SimplyBook.me | Google, Outlook web (Exchange — нет) | платная фича «sync busy time», лаг до 10 минут | экспорт события через API |
| TidyCal | Google, O365, iCloud | per-calendar read/write; «Free» игнорируется; webhooks + polling, iCloud лагает 30–45 мин | автосоздание в календарях с write-доступом |
| Koalendar | Google, Outlook, iCloud | «only Busy events block time»; all-day в Google по умолчанию Free | автосоздание в Google Calendar |

Источники: Calendly — https://calendly.com/help/connect-your-calendar-to-calendly и https://community.calendly.com/how-do-i-40/calendar-conflicts-and-your-calendar-s-free-busy-status-653 («events marked as "Free" will be ignored by Calendly»); Acuity — https://acuityscheduling.com/learn/sync-with-third-party-calendars (help-центр на Zendesk отдаёт роботам 403, детали Free/Busy не проверены); SimplyBook — https://help.simplybook.me/index.php/Calendar_Sync_custom_feature (там же известный баг: при ёмкости слота >1 экспортированная бронь сама блокирует слот); TidyCal — https://help.tidycal.com/article/751-calendar-configuration-guide и https://help.tidycal.com/article/744-comprehensive-faq; Koalendar — https://koalendar.com/features/calendar-sync и https://help.koalendar.com/article/55-troubleshooting-availability.

### Cal.com под микроскопом (по коду репозитория)

Самый полезный референс, потому что показывает точную схему в открытом коде (https://github.com/calcom/cal.com):

- **Busy-check**: `packages/features/busyTimes/services/getBusyTimes.ts` — busy = свои брони из БД + `getBusyCalendarTimes` из `packages/features/calendars/lib/CalendarManager.ts`. Для Google (`packages/app-store/googlecalendar/lib/CalendarService.ts`) — именно `calendar.freebusy.query`, с чанкованием диапазона по 90 дней. Для CalDAV/iCloud — общий класс `packages/lib/CalendarService.ts` на библиотеке **tsdav** + парсинг ICS через ical.js; события с `TRANSP:TRANSPARENT` пропускаются.
- **Входящий ICS-фид как источник занятости**: пакет `packages/app-store/ics-feedcalendar` — read-only календарь по URL, `createEvent` отвечает «ICS feed is read-only». То есть даже у эталона busy-check по подписной ICS-ссылке — легитимный первоклассный способ, без OAuth.
- **Кэш и подписка на изменения**: `packages/features/calendar-subscription/` — Google `events.watch` (каналы) + инкрементальная синхра `events.list` с `syncToken`; Microsoft Graph subscriptions с TTL 3 дня + delta links; продление каналов — **кроны** (`apps/web/app/api/cron/calendar-subscriptions/route.ts`). Релиз v4.8 (https://cal.com/blog/v-4-8): кэш ускоряет показ слотов на 300–500 мс, webhooks держат его свежим.
- **Ключевая деталь про конфликты**: `packages/app-store/_utils/getCalendar.ts` — кэш используется только в режиме показа слотов (`mode === "slots"`); в момент подтверждения брони (`mode === "booking"`) кэш игнорируется и занятость проверяется живым запросом (`handleNewBooking/ensureAvailableUsers.ts` → `checkForConflicts.ts`). Т.е. двойная проверка: дёшево при показе, честно при подтверждении.
- **Исходящего ICS-фида броней у Cal.com нет** — `text/calendar` встречается только в ссылках «добавить в календарь» для участника (`packages/features/bookings/lib/getCalendarLinks.ts`); письма собирают `.ics` через `packages/emails/lib/generateIcsFile.ts` (METHOD:REQUEST/CANCEL — как наш `buildIcs`).

## Технические первоисточники

### Google Calendar API

- **freebusy.query** (https://developers.google.com/calendar/api/v3/reference/freebusy/query): busy-интервалы по до **50 календарей** за запрос (`calendarExpansionMax`), без деталей событий. Квоты (https://developers.google.com/calendar/api/guides/quota): 10 000 запросов/мин на проект, 600/мин на пользователя — для нас недостижимые потолки.
- **Push (events.watch)** (https://developers.google.com/workspace/calendar/api/guides/push): webhook обязан быть HTTPS с валидным сертификатом; уведомление не содержит данных — после пинга нужен `events.list`; TTL канала по умолчанию 7 дней и **автопродления нет** («Currently, there's no automatic way to renew a notification channel») — т.е. без крона каналы умирают.
- **Инкрементальная синхра** (https://developers.google.com/calendar/api/guides/sync): `events.list` с `syncToken`; сервер может инвалидировать токен → **410 GONE** → полный ресинк с нуля. Это обязательный сценарий, а не крайний случай.
- **OAuth verification — главный ценник для MVP.** Calendar-scopes — **sensitive** (https://developers.google.com/workspace/calendar/api/auth, https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification): нужны privacy policy на домене приложения, подтверждение домена в Search Console и **демо-видео OAuth-флоу на YouTube**; заявленный срок «up to 10 days», по кейсам — недели (https://www.nylas.com/blog/google-oauth-app-verification/). Без верификации — экран «unverified app» и лимит **100 пользователей** (https://support.google.com/cloud/answer/7454865). Утешение: ежегодный платный security assessment ($15k+) нужен только для restricted-scopes (Gmail/Drive) и календаря не касается (https://support.google.com/cloud/answer/13464321).

### CalDAV — путь к Яндексу и Apple без OAuth

- **RFC 4791** (https://datatracker.ietf.org/doc/html/rfc4791): `free-busy-query REPORT` (§7.10) — сервер сам считает VFREEBUSY за интервал; `calendar-query REPORT` (§7.8) — выборка событий по time-range. **RFC 6578** (https://datatracker.ietf.org/doc/html/rfc6578) — `sync-collection` для инкрементальной синхры (протухший токен → полный ресинк, аналог 410 у Google). Аутентификация — обычный HTTP Basic: **никакой OAuth-верификации не нужно**, но пользователь должен сам сгенерировать пароль приложения — UX-трение.
- **iCloud**: endpoint `caldav.icloud.com` Apple официально **не документирует** (только сторонние гайды: https://tasks.org/docs/caldav_icloud/); вход — по app-specific password (https://support.apple.com/en-us/102654). Cal.com работает с iCloud именно так (https://cal.com/apps/caldav-calendar). Push для сторонних нет — только polling; поведение сервера меняется без анонсов.
- **Яндекс.Календарь**: официальная справка подтверждает `https://caldav.yandex.ru` + пароль приложения типа «Календарь» (https://yandex.com/support/calendar/sync/sync-mobile.html; пароли приложений: https://yandex.ru/support/id/authorization/app-passwords.html). Поддержка `free-busy-query`/`sync-collection` **не документирована**; по косвенным признакам (workarounds в Outlook CalDAV Synchronizer — https://github.com/aluxnimm/outlookcaldavsynchronizer/blob/master/README.md, баги в caldav4j — https://github.com/caldav4j/caldav4j/issues/65) рассчитывать стоит на `calendar-query` + polling и проверять на живом сервере.

### Почему все говорят, что это сложно

- Cal.com о CalDAV (https://cal.com/blog/the-intricacies-and-challenges-of-implementing-a-caldav-supporting-system-for-cal): серверы по-разному трактуют iCalendar, таймзоны представляются тремя способами, Zoho «fails silently» на EXPAND при HTTP 200 — «one size fits all» нереалистичен, нужны адаптеры под каждый сервер.
- Nylas про recurring events (https://cli.nylas.com/guides/recurring-calendar-events-api): у Google исключение из серии — отдельный event с `originalStartTime`, в iCalendar — второй VEVENT с RECURRENCE-ID; экспансия по UTC вместо именованной таймзоны даёт DST-дрейф. (Нам это почти не грозит: МСК без перевода часов, но события в календарях психологов бывают в любых таймзонах.)
- Cronofy (https://www.cronofy.com/build-or-buy-calendar-integrations): availability-логика сложнее, чем кажется; при in-house решении команда владеет каждым сбоем каждого провайдера.
- Классика жанра: «Falsehoods programmers believe about time» (https://infiniteundo.com/post/25326999628/falsehoods-programmers-believe-about-time).

### Агрегаторы как ориентир цены вопроса

- **Nylas** (https://www.nylas.com/pricing/): Calendar-план — $10/мес база + **$1.50/подключённый аккаунт/мес** (5 включено). Т.е. «купить» календарную синхру для 50 психологов стоило бы ~$80/мес — но добавляет внешнюю зависимость и передачу данных в США.
- **Cronofy** (https://www.cronofy.com/api-pricing): от **$819/мес** — enterprise-порядок, не для нас. Сам факт, что компании платят такие деньги за «просто календарную синхру», — оценка её реальной трудоёмкости.

## Что это значит для mipsy

Сравнение вариантов с учётом наших ограничений (SQLite, нет крона/воркеров, один контейнер, слоты — строка МСК, `.ics` клиенту уже есть):

| Вариант | Сложность | Что даёт | Вердикт |
|---|---|---|---|
| Ручные слоты (сейчас) | 0 | уровень Alter/Ясно, выше SmartMental/PsyPsy | база остаётся |
| `.ics` психологу при брони | ~час | встреча сама появляется в его календаре из письма | сделать сразу |
| Исходящий ICS-фид «мои встречи mipsy» | 1–2 дня | подписка в любом календаре (Google/Яндекс/Apple), фича, которой нет даже у Calendly | этап 1 |
| Busy-check по входящей ICS-ссылке | 2–4 дня | психолог вставляет приватную ICS-ссылку своего календаря, занятые окна скрываются | этап 2 |
| Busy-check по CalDAV (Яндекс/iCloud) | 1–2 недели + зоопарк серверов | свежесть лучше, чем у ICS-ссылки | этап 3, по запросу психологов |
| Google OAuth + freebusy + watch | недели + верификация Google + нужен крон | модель Calendly/Cal.com целиком | не для MVP |
| Двусторонняя синхра | месяцы | availability «из календаря» | не делать вообще |

**Этап 0 — `.ics` в письмо психологу (сделать при первом же касании кода).** `meetingInvite` уже существует и уходит клиенту; психологу при `psyBooked` уходит только текст (`src/app/me/actions.ts`). Приложить тот же `.ics` — почти нулевая работа, а Gmail/Яндекс.Почта сами предложат добавить событие. Это ровно «email с .ics», которым закрывается вопрос у Calendly для приглашённых.

**Этап 1 — исходящий ICS-фид броней.** Роут вида `/api/psy-feed/<секретный-токен>.ics`, отдающий VCALENDAR со всеми `booked`-слотами психолога (генерация — тот же `buildIcs`, только несколько VEVENT и METHOD:PUBLISH вместо REQUEST). Психолог подписывается один раз — «календарь mipsy» появляется рядом с личным во всех трёх провайдерах. Идеально ложится на наши ограничения: чтение из SQLite по запросу, ни крона, ни OAuth, ни исходящих интеграций; токен — отдельная колонка у психолога (по образцу бывшего `cabinetToken`). Оговорка: внешние ICS-подписки календари обновляют сами и нечасто (Google — с лагом до нескольких часов, точный интервал не гарантируется), поэтому фид — дополнение к письму из этапа 0, а не замена. Отмену/перенос фид отражает автоматически (событие исчезает/сдвигается при следующем обновлении) — письма про отмену всё равно остаются основным каналом.

**Этап 2 — busy-check по входящей ICS-ссылке (модель `ics-feedcalendar` из Cal.com).** У Google, Яндекса и Apple есть приватные ссылки на экспорт календаря в iCal-формате (у Google — «секретный адрес в формате iCal», https://support.google.com/calendar/answer/37648; у Яндекса и iCloud — экспортные/публичные ссылки, точные механики проверить на живых аккаунтах при реализации). Психолог вставляет ссылку в /cab; при показе слотов клиенту мы скачиваем фид (кэш в SQLite с TTL 10–15 минут — скачивание по запросу, воркер не нужен), парсим VEVENT, события с `TRANSP:TRANSPARENT` игнорируем (как все эталоны) и **скрываем** пересекающиеся `free`-слоты, не удаляя их. Правило конфликтов — как у Cal.com: фильтрация при показе по кэшу + свежая проверка в `takeSlot` при подтверждении; если фид недоступен или протух — показываем слоты как есть (сегодняшнее поведение остаётся деградационным дном: бронь выигрывает, психолог переносит через оператора). Главная засада — RRULE: повторяющиеся события в фиде нужно разворачивать (ical.js/rrule-библиотека), это основная часть работы.

**Этап 3 — CalDAV с паролями приложений (Яндекс/iCloud), только по запросу психологов.** Даёт свежесть по требованию (`calendar-query` с time-range через tsdav — путь Cal.com) вместо «когда Google обновит фид». Без OAuth-верификации, но с UX-трением (психолог генерирует пароль приложения) и зоопарком серверных капризов, про который Cal.com написал отдельный пост. Делать после того, как этап 2 упрётся в свежесть данных, и начинать с одного провайдера — Яндекса (наша аудитория).

**Не делать.** Google OAuth (freebusy + watch) — для MVP это верификация приложения у Google (privacy policy, Search Console, демо-видео, дни-недели ожидания, до того — потолок 100 пользователей) плюс обязательный крон на продление watch-каналов и обработка 410 GONE; ценность против этапа 2 — только свежесть busy-данных. Двустороннюю синхру не делает никто из эталонов — даже Cal.com строит availability только из своих schedules, а календарь лишь вычитает время; для нас она ещё и ломает принцип «слот — единственный источник правды».

Отдельный продуктовый вывод: российские конкуренты нишу не закрыли (у Zigmund — одна строчка про Google Календарь без деталей, у остальных — ничего), поэтому даже этапы 0–1 — простые, но заметные в питче психологам «встречи mipsy сами появляются в вашем календаре».
