/**
 * Приглашение на встречу в формате iCalendar — его понимают Google Calendar,
 * Яндекс.Календарь, Outlook и Apple Calendar. Время слотов московское,
 * поэтому переводим в UTC вычитанием трёх часов.
 */
const MSK_OFFSET_H = 3;

function toUtcStamp(startsAt: string, plusMinutes = 0): string {
  const [date, time] = startsAt.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh - MSK_OFFSET_H, mm + plusMinutes));
  return utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export type IcsEvent = {
  uid: string;
  startsAt: string;
  durationMin: number;
  summary: string;
  description: string;
  url?: string;
};

/**
 * UID события — «бронь», а не «окно»: слоты переиспользуются (отмена
 * освобождает окно для другого клиента), и отзыв старого события с UID слота
 * убивал бы событие новой брони в том же окне.
 */
export function bookingUid(slotId: number, clientRequestId: number | null): string {
  return `mipsy-slot-${slotId}-r${clientRequestId ?? 0}@mipsy.mskacademy.ru`;
}

function eventLines(e: IcsEvent, opts: { alarmText?: string; cancelled?: boolean } = {}): (string | null)[] {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    // DTSTAMP берём от начала встречи: детерминированно и не ломает сравнение писем.
    `DTSTAMP:${toUtcStamp(e.startsAt)}`,
    `DTSTART:${toUtcStamp(e.startsAt)}`,
    `DTEND:${toUtcStamp(e.startsAt, e.durationMin)}`,
    // Отзыв должен «победить» исходное приглашение (SEQUENCE:0 по умолчанию).
    opts.cancelled ? "SEQUENCE:1" : null,
    opts.cancelled ? "STATUS:CANCELLED" : null,
    `SUMMARY:${escapeText(e.summary)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    e.url ? `URL:${e.url}` : null,
    ...(opts.alarmText
      ? [
          "BEGIN:VALARM",
          "TRIGGER:-PT1H",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeText(opts.alarmText)}`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
  ];
}

export function buildIcs(params: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mipsy//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...eventLines(params, { alarmText: "Встреча с психологом через час" }),
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

/**
 * Отзыв приглашения (METHOD:CANCEL) с тем же UID: календарь получателя
 * помечает событие отменённым или убирает его. Шлём при отмене и переносе —
 * иначе в календаре навсегда остаётся встреча, которой не будет.
 */
export function buildCancelIcs(params: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mipsy//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:CANCEL",
    ...eventLines(params, { cancelled: true }),
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}

/**
 * Календарь-подписка (METHOD:PUBLISH): Google/Яндекс/Apple опрашивают URL сами,
 * поэтому исчезнувшее из фида событие пропадает и у подписчика — отмены и
 * переносы разъезжаются без писем.
 */
export function buildFeed(params: { name: string; events: IcsEvent[] }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mipsy//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(params.name)}`,
    "X-PUBLISHED-TTL:PT1H",
    ...params.events.flatMap((e) => eventLines(e, { alarmText: "Сессия через час" })),
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}
