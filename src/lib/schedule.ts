/**
 * Расписание психолога: чистые функции без базы — одни и те же в редакторах
 * кабинета, серверном действии и тестах. Время — московское «YYYY-MM-DDTHH:MM»,
 * как в таблице slots.
 */

export const SESSION_TYPES = [
  { minutes: 50, label: "Индивидуальная", short: "Индив." },
  { minutes: 90, label: "Парная", short: "Парная" },
] as const;

export type SessionMinutes = (typeof SESSION_TYPES)[number]["minutes"];

export const sessionLabel = (minutes: number) =>
  SESSION_TYPES.find((t) => t.minutes === minutes)?.label ?? `${minutes} мин`;

/** Сетка редакторов: с 08:00 до 22:00 с шагом 30 минут. */
export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 22 * 60;
export const STEP_MIN = 30;

export type Interval = { startsAt: string; durationMin: number };

const toMs = (startsAt: string) => Date.parse(`${startsAt}:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 16);

export function addMinutes(startsAt: string, minutes: number): string {
  return fromMs(toMs(startsAt) + minutes * 60000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(date, -shift);
}

export const minutesOfDay = (startsAt: string) =>
  Number(startsAt.slice(11, 13)) * 60 + Number(startsAt.slice(14, 16));

export const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Пересекаются ли две сессии с учётом длительности (касание концами — не пересечение). */
export function overlaps(a: Interval, b: Interval): boolean {
  const a0 = toMs(a.startsAt);
  const b0 = toMs(b.startsAt);
  return a0 < b0 + b.durationMin * 60000 && b0 < a0 + a.durationMin * 60000;
}

export function overlapsAny(candidate: Interval, others: Interval[]): boolean {
  return others.some((o) => overlaps(candidate, o));
}

/**
 * Рабочие часы недели → конкретные сессии на период. Каждый промежуток дня
 * нарезается сессиями своего типа с перерывом между ними; хвост, в который
 * сессия целиком не помещается, отбрасывается.
 */
export type WorkRange = { from: string; to: string; minutes: number };
export type WeekTemplate = Record<number, WorkRange[]>; // 0 = понедельник … 6 = воскресенье

export function sessionsFromTemplate(
  template: WeekTemplate,
  params: { startDate: string; days: number; breakMin: number },
): Interval[] {
  const out: Interval[] = [];
  for (let i = 0; i < params.days; i++) {
    const date = addDays(params.startDate, i);
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
    for (const range of template[weekday] ?? []) {
      const end = minutesOfDay(`${date}T${range.to}`);
      let t = minutesOfDay(`${date}T${range.from}`);
      while (t + range.minutes <= end) {
        out.push({ startsAt: `${date}T${timeOf(t)}`, durationMin: range.minutes });
        t += range.minutes + params.breakMin;
      }
    }
  }
  return out;
}

/** Сессии недели, сдвинутые на 1…N недель вперёд — «повторить неделю». */
export function repeatWeeks(week: Interval[], weeks: number): Interval[] {
  const out: Interval[] = [];
  for (let w = 1; w <= weeks; w++) {
    for (const s of week) out.push({ startsAt: addMinutes(s.startsAt, w * 7 * 24 * 60), durationMin: s.durationMin });
  }
  return out;
}
