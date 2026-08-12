# Деплой mipsy на VPS

Прототип живёт на VPS `91.197.99.37` в Docker-контейнере и доступен по адресу **https://mipsy.mskacademy.ru**

## Домен и HTTPS

- A-запись `mipsy` в зоне `mskacademy.ru` (панель reg.ru) → `91.197.99.37`.
- nginx: `/etc/nginx/sites-available/mipsy.conf` + симлинк в `sites-enabled` — по образцу соседних сайтов (snippets `security-headers` и `proxy-nextjs`, `limit_req zone=req_limit`), проксирует на `127.0.0.1:8081`.
- Сертификат Let's Encrypt выпущен certbot'ом (`certbot --nginx -d mipsy.mskacademy.ru --redirect`), продление автоматическое. HTTP отдаёт 301 на HTTPS.
- Контейнер слушает **только 127.0.0.1:8081** — снаружи порт закрыт, весь трафик идёт через nginx по HTTPS.
- Домен временный: `mipsy.mskacademy.ru` — поддомен чужого бренда. Перед платным трафиком стоит взять собственный домен (`mipsy.ru` на момент проверки 2026-08-12 свободен) — тогда достаточно повторить два шага: A-запись и `certbot --nginx -d <домен>`.

## Устройство

- Образ собирается из `Dockerfile` (multi-stage: npm ci с python3/make/g++ для better-sqlite3 → next build standalone → лёгкий рантайм).
- При старте контейнер запускает `scripts/migrate.mjs`: применяет SQL-миграции из `drizzle/` (журнал — таблица `_migrations`) и сидит справочник тем. Использует только better-sqlite3 — drizzle-orm в standalone не попадает.
- БД: SQLite в volume `/root/mipsy-data` на хосте (`/app/data/mipsy.db` в контейнере) — переживает пересборки.
- Пароль оператора передаётся через `-e OPERATOR_PASSWORD=…` (админка: `/op`).
- `-e SITE_URL=https://mipsy.mskacademy.ru` — подставляется в ссылки внутри SMS.
- SMS: `-e SMS_LOGIN=… -e SMS_PASSWORD=… [-e SMS_SENDER=…]` (провайдер smsc.ru). Без них уведомления копятся в `/op/notifications`, оператор отправляет вручную.
- Загруженные фото психологов лежат в `/root/mipsy-data/uploads` (тот же volume, что и база) и отдаются роутом `/uploads/[name]`.

## Бэкапы

`/root/mipsy-backup.sh` (исходник — `scripts/backup.sh`) запускается кроном ежедневно в 04:00: делает `VACUUM INTO` без остановки сервиса, жмёт gzip, отдельно архивирует загруженные фото, хранит 14 дней в `/root/mipsy-data/backups`. Лог — `/var/log/mipsy-backup.log`. Проверка восстановления: распаковать копию и открыть её через `docker run --rm -v …:/t mipsy node -e "…"`.

## Мониторинг и алерты

`/root/mipsy-healthcheck.sh` (исходник — `scripts/healthcheck.sh`) раз в 5 минут по крону дёргает `/api/health` (отвечает приложение + читается база) и считает новые ошибки в журнале за час. Лог — `/var/log/mipsy-health.log`. Письма-алерты уходят, только если в `/root/mipsy-alert-email` записан адрес; файла нет — алерты остаются в логе. Журнал ошибок приложения виден оператору в `/op/errors`, журнал его собственных действий — в `/op/audit`.

## Доступ в кабинеты

Кабинеты клиента и психолога открываются по секретной ссылке, но с нового устройства требуют код из шести цифр — он уходит на почту или телефон владельца, а после ввода ставится подписанная кука на 60 дней. Тот, кто только что сам оставил заявку или подал анкету, подтверждён сразу. Если код не доходит, оператор видит его в карточке психолога и в карточке заявки и может продиктовать по телефону.

## Тесты

`npm test` — 13 проверок на node:test: перевод в московское время, правило 24 часов, гонка за слот на настоящей SQLite, кризисный флаг, фильтр контактов в профиле.

## Обновление версии

```bash
# из /workspace/mipsy (контейнер разработки):
tar czf - --exclude node_modules --exclude .next --exclude .git --exclude data --exclude .env.local . \
  | ssh -i /root/.ssh/id_ed25519_vps root@91.197.99.37 \
    'rm -rf /root/mipsy-src && mkdir -p /root/mipsy-src && tar xzf - -C /root/mipsy-src'

ssh -i /root/.ssh/id_ed25519_vps root@91.197.99.37 '
  cd /root/mipsy-src && docker build -t mipsy . &&
  docker rm -f mipsy &&
  docker run -d --name mipsy --restart unless-stopped -p 127.0.0.1:8081:3000 \
    -v /root/mipsy-data:/app/data -e OPERATOR_PASSWORD=<пароль> mipsy
'
```

При изменении схемы БД: `npx drizzle-kit generate` локально (создаст новый файл в `drizzle/`), закоммитить — контейнер применит его при старте.

## Локальная разработка

```bash
npm install
npx drizzle-kit push   # схема в data/mipsy.db
npm run db:seed        # справочник тем
echo 'OPERATOR_PASSWORD=dev' > .env.local
npm run dev
```

## Заметки

- scp/sftp на VPS не работают (restrict в authorized_keys) — только tar поверх ssh-exec.
- nginx на VPS боевой и чужой — не трогаем; наружу смотрит порт 8081 напрямую через docker-proxy.
- Пароль оператора в репозиторий не коммитим.
