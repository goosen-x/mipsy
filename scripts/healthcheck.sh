#!/bin/bash
# Алерты: раз в 5 минут проверяем, что сайт жив и в журнале нет новых ошибок.
# Ставится в cron на VPS:
#   */5 * * * * /root/mipsy-healthcheck.sh >> /var/log/mipsy-health.log 2>&1
#
# Куда слать: если в /root/mipsy-alert-email лежит адрес — уходит письмо тем же
# SMTP, что и уведомления сервиса. Без файла алерты только пишутся в лог.
set -uo pipefail

URL=https://mipsy.mskacademy.ru/api/health
STATE=/root/mipsy-health.state
ALERT_FILE=/root/mipsy-alert-email
NOW=$(date '+%F %T')

send_alert() {
  local subject="$1" body="$2"
  echo "$NOW ALERT: $subject — $body"
  [ -s "$ALERT_FILE" ] || return 0
  local to
  to=$(head -1 "$ALERT_FILE")
  docker exec mipsy node -e "
    const nodemailer = require('/app/node_modules/nodemailer');
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    t.sendMail({
      from: process.env.SMTP_FROM, to: '$to',
      subject: 'mipsy: $subject',
      text: \`$body\n\nВремя: $NOW\`,
    }).then(() => console.log('alert sent')).catch(e => console.log('alert failed', e.message));
  " 2>/dev/null || echo "$NOW не удалось отправить письмо-алерт"
}

# 1. Доступность
CODE=$(curl -s -o /tmp/mipsy-health.json -w '%{http_code}' --max-time 20 "$URL" || echo 000)
PREV=$(cat "$STATE" 2>/dev/null || echo ok)

if [ "$CODE" != "200" ]; then
  [ "$PREV" = "down" ] || send_alert "сайт не отвечает" "Проверка $URL вернула код $CODE. Контейнер: $(docker inspect -f '{{.State.Status}}' mipsy 2>/dev/null || echo 'не найден')."
  echo down > "$STATE"
  exit 1
fi

if [ "$PREV" = "down" ]; then
  send_alert "сайт снова работает" "Проверка $URL вернула 200."
fi
echo ok > "$STATE"

# 2. Новые ошибки в журнале приложения
ERRORS=$(docker exec mipsy node -e "
  const d = require('better-sqlite3')('/app/data/mipsy.db', { readonly: true });
  console.log(d.prepare(\"SELECT count(*) c FROM error_log WHERE seen = 0 AND created_at > datetime('now','-1 hour')\").get().c);
" 2>/dev/null | tr -dc '0-9')

if [ -n "${ERRORS:-}" ] && [ "$ERRORS" -gt 0 ]; then
  LAST_REPORT=$(cat /root/mipsy-errors.state 2>/dev/null || echo 0)
  if [ "$ERRORS" != "$LAST_REPORT" ]; then
    send_alert "ошибки в приложении" "За последний час новых ошибок: $ERRORS. Смотрите https://mipsy.mskacademy.ru/op/errors"
    echo "$ERRORS" > /root/mipsy-errors.state
  fi
else
  echo 0 > /root/mipsy-errors.state
fi

echo "$NOW ok · код $CODE · ошибок за час: ${ERRORS:-0}"
