/**
 * Время слотов хранится строкой "YYYY-MM-DDTHH:mm" в **московском времени** —
 * так же, как у конкурентов (SmartMental и Zigmund показывают расписание «по МСК»).
 * Это избавляет от рассинхрона, когда психолог и клиент в разных поясах.
 */
export const TZ_LABEL = "по московскому времени";
export const TZ_SHORT = "МСК";
const MSK_OFFSET_MIN = 3 * 60; // UTC+3, без перехода на летнее время

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Текущее московское время в формате хранения слотов. */
export function nowMsk(now: Date = new Date()): string {
  const msk = new Date(now.getTime() + MSK_OFFSET_MIN * 60_000);
  return `${msk.getUTCFullYear()}-${pad(msk.getUTCMonth() + 1)}-${pad(msk.getUTCDate())}T${pad(msk.getUTCHours())}:${pad(msk.getUTCMinutes())}`;
}

/** Московское время через N часов — для правила «отмена не позднее чем за 24 часа». */
export function mskPlusHours(hours: number, now: Date = new Date()): string {
  return nowMsk(new Date(now.getTime() + hours * 3600_000));
}

export function isPast(startsAt: string, now: Date = new Date()): boolean {
  return startsAt < nowMsk(now);
}

/** Можно ли клиенту самому отменить или перенести встречу. */
export function canClientChange(startsAt: string, now: Date = new Date()): boolean {
  return startsAt >= mskPlusHours(24, now);
}

export function formatSlot(startsAt: string): string {
  const [date, time] = startsAt.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d} ${MONTHS[m - 1]}, ${weekday}, ${time} ${TZ_SHORT}`;
}

/**
 * Метки времени из базы (UTC «YYYY-MM-DD HH:MM[:SS]») — в московское для
 * админки: раньше оператор видел сырой UTC рядом со слотами «по МСК».
 */
export function formatDbTime(value: string | null | undefined): string {
  if (!value) return "—";
  const ms = Date.parse(`${value.slice(0, 16).replace(" ", "T")}:00Z`);
  if (Number.isNaN(ms)) return value;
  const msk = new Date(ms + MSK_OFFSET_MIN * 60_000);
  return `${pad(msk.getUTCDate())}.${pad(msk.getUTCMonth() + 1)} ${pad(msk.getUTCHours())}:${pad(msk.getUTCMinutes())} ${TZ_SHORT}`;
}

/** Возраст метки времени из базы (UTC) в часах — для контроля SLA. */
export function dbTimeAgeHours(value: string, now: Date = new Date()): number {
  const ms = Date.parse(`${value.slice(0, 16).replace(" ", "T")}:00Z`);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, (now.getTime() - ms) / 3_600_000);
}

/** День (YYYY-MM-DD) по МСК для метки времени из базы — для группировок. */
export function dbTimeMskDay(value: string): string {
  const ms = Date.parse(`${value.slice(0, 16).replace(" ", "T")}:00Z`);
  if (Number.isNaN(ms)) return value.slice(0, 10);
  return new Date(ms + MSK_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d} ${MONTHS[m - 1]}, ${weekday}`;
}

export function groupByDate<T extends { startsAt: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const day = item.startsAt.split("T")[0];
    map.set(day, [...(map.get(day) ?? []), item]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
