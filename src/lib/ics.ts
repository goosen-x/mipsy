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

export function buildIcs(params: {
  uid: string;
  startsAt: string;
  durationMin: number;
  summary: string;
  description: string;
  url?: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mipsy//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    // DTSTAMP берём от начала встречи: детерминированно и не ломает сравнение писем.
    `DTSTAMP:${toUtcStamp(params.startsAt)}`,
    `DTSTART:${toUtcStamp(params.startsAt)}`,
    `DTEND:${toUtcStamp(params.startsAt, params.durationMin)}`,
    `SUMMARY:${escapeText(params.summary)}`,
    `DESCRIPTION:${escapeText(params.description)}`,
    params.url ? `URL:${params.url}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Встреча с психологом через час",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n") + "\r\n";
}
