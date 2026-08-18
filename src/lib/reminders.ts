// Напоминания клиентам за сутки до встречи. Отбор вынесен в чистую функцию
// с базой параметром (по образцу booking.ts) — проверяется тестами без Next;
// отправкой занимается планировщик (reminder-scheduler.ts).
import { and, eq, gt, inArray, isNotNull, lte } from "drizzle-orm";
import { clientRequests, notifications, psychologists, slots } from "../db/schema.ts";
import type { Db } from "./booking.ts";
import { mskPlusHours } from "./datetime.ts";

export type DueReminder = {
  slotId: number;
  startsAt: string;
  clientRequestId: number;
  psychologistId: number;
  psyName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
};

/**
 * Брони, которым пора напомнить: встреча через 20–24 часа и напоминание по
 * этому слоту ещё не ставилось в очередь. Окно в четыре часа прощает простой
 * планировщика; записавшимся позднее чем за 20 часов не напоминаем — они
 * только что видели подтверждение. Идемпотентно через таблицу notifications:
 * очередь и есть журнал отправленного.
 */
export async function dueReminders(db: Db, now: Date = new Date()): Promise<DueReminder[]> {
  const from = mskPlusHours(20, now);
  const to = mskPlusHours(24, now);

  const rows = await db
    .select({
      slotId: slots.id,
      startsAt: slots.startsAt,
      clientRequestId: slots.clientRequestId,
      psychologistId: slots.psychologistId,
      psyName: psychologists.name,
      clientName: clientRequests.name,
      clientPhone: clientRequests.phone,
      clientEmail: clientRequests.email,
    })
    .from(slots)
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .innerJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(
      and(
        eq(slots.status, "booked"),
        isNotNull(slots.clientRequestId),
        gt(slots.startsAt, from),
        lte(slots.startsAt, to),
      ),
    );
  if (rows.length === 0) return [];

  const reminded = await db
    .select({ slotId: notifications.slotId })
    .from(notifications)
    .where(
      and(
        eq(notifications.kind, "reminder"),
        inArray(
          notifications.slotId,
          rows.map((r) => r.slotId),
        ),
      ),
    );
  const done = new Set(reminded.map((r) => r.slotId));
  return rows.filter((r) => !done.has(r.slotId)) as DueReminder[];
}

export type DueSurvey = DueReminder & {
  psyPhone: string;
  psyEmail: string | null;
};

/**
 * Опрос после встречи, итог которой психолог не отметил: прошло больше суток,
 * бронь так и висит в «booked». Клиента спрашиваем, как прошла встреча,
 * психолога просим отметить итог. Окно до четырёх суток — старьё не бомбим.
 * Идемпотентность та же: по уведомлению kind=review на слоте (при отметке
 * «done» руками психолога письмо клиенту уходит сразу — второй раз не шлём).
 */
export async function dueOutcomeSurveys(db: Db, now: Date = new Date()): Promise<DueSurvey[]> {
  const from = mskPlusHours(-96, now);
  const to = mskPlusHours(-24, now);

  const rows = await db
    .select({
      slotId: slots.id,
      startsAt: slots.startsAt,
      clientRequestId: slots.clientRequestId,
      psychologistId: slots.psychologistId,
      psyName: psychologists.name,
      psyPhone: psychologists.phone,
      psyEmail: psychologists.email,
      clientName: clientRequests.name,
      clientPhone: clientRequests.phone,
      clientEmail: clientRequests.email,
    })
    .from(slots)
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .innerJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(
      and(
        eq(slots.status, "booked"),
        isNotNull(slots.clientRequestId),
        gt(slots.startsAt, from),
        lte(slots.startsAt, to),
      ),
    );
  if (rows.length === 0) return [];

  const surveyed = await db
    .select({ slotId: notifications.slotId })
    .from(notifications)
    .where(
      and(
        eq(notifications.kind, "review"),
        inArray(
          notifications.slotId,
          rows.map((r) => r.slotId),
        ),
      ),
    );
  const done = new Set(surveyed.map((r) => r.slotId));
  return rows.filter((r) => !done.has(r.slotId)) as DueSurvey[];
}
