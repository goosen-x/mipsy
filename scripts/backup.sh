#!/bin/bash
# Ежедневный бэкап базы mipsy. Ставится в cron на VPS:
#   0 4 * * * /root/mipsy-backup.sh >> /var/log/mipsy-backup.log 2>&1
set -euo pipefail

DATA_DIR=/root/mipsy-data
BACKUP_DIR=$DATA_DIR/backups
KEEP_DAYS=14
STAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUP_DIR"

# VACUUM INTO делает согласованную копию при включённом WAL, не останавливая сервис.
docker exec mipsy node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/data/mipsy.db', { readonly: true });
db.exec(\"VACUUM INTO '/app/data/backups/mipsy-$STAMP.db'\");
db.close();
console.log('ok');
"

gzip -f "$BACKUP_DIR/mipsy-$STAMP.db"

# Загруженные фото — отдельно, они не в базе.
if [ -d "$DATA_DIR/uploads" ]; then
  tar czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
fi

find "$BACKUP_DIR" -name '*.gz' -mtime +$KEEP_DAYS -delete

echo "$(date '+%F %T') бэкап готов: mipsy-$STAMP.db.gz ($(du -h "$BACKUP_DIR/mipsy-$STAMP.db.gz" | cut -f1))"
