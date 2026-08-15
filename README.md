# mipsy

Агрегатор психологов: каталог проверенных специалистов + сервисный подбор.
Опорная модель — «институт → верифицированные выпускники → подбор → сопровождение»
(основной референс: SmartMental).

Работающий прототип развёрнут на **https://mipsy.mskacademy.ru** и собирает
реальные заявки клиентов и психологов. Стек: Next.js (App Router, server
actions), SQLite + Drizzle, Docker на VPS. Продуктовые решения фиксируются в `docs/`.

## Документация

- [`docs/spec/prototype.md`](docs/spec/prototype.md) — спек прототипа и журнал изменений после его фиксации.
- [`docs/spec/flow.md`](docs/spec/flow.md) — карта продукта: роли, страницы, серверные действия, данные, инструменты.
- [`docs/spec/tz-checklist.md`](docs/spec/tz-checklist.md) — сверка с ТЗ по разделам (рынок, MVP, CJM, техресурсы).
- [`docs/spec/funkcii-po-rolyam.md`](docs/spec/funkcii-po-rolyam.md) — матрица функций по ролям со статусами реализации.
- [`docs/spec/cabinets-audit.md`](docs/spec/cabinets-audit.md) — целевое устройство кода кабинетов, итоги аудита, карта тестов.
- [`docs/spec/backlog.md`](docs/spec/backlog.md) — отложенные задачи, юридический контур, долги.
- [`docs/deploy.md`](docs/deploy.md) — деплой, бэкапы, мониторинг, вход в кабинеты, локальная разработка.

## Исследования

- [`docs/research/konkurenty-vyvody.csv`](docs/research/konkurenty-vyvody.csv) —
  анализ 7 конкурентов (SmartMental, Alter, Ясно, Zigmund.Online, PsyPsy, B17,
  Profi.ru): что формирует доверие, что берём в гипотезы MVP, что не переносим
  на старт. Ключевые выводы для MVP — внизу файла.
- [`docs/research/dopusk-referensy.md`](docs/research/dopusk-referensy.md) — критерии допуска специалистов у референсов.
- [`docs/research/katalog-ux.md`](docs/research/katalog-ux.md) — UX каталогов людей, редизайн карточек.
- [`docs/research/kalendar-sloty-sinhronizaciya.md`](docs/research/kalendar-sloty-sinhronizaciya.md) — календарь, слоты, синхронизация.
- [`docs/research/mip-design.md`](docs/research/mip-design.md) — дизайн-система по mip.institute.
- [`docs/research/psypsy-landing.md`](docs/research/psypsy-landing.md), [`docs/research/psypsy-quiz.md`](docs/research/psypsy-quiz.md) — разбор лендинга и анкеты PsyPsy.
