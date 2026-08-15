import { and, eq, gte, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
// Расширения в путях обязательны: модуль импортируют и Next, и node --test.
import * as schema from "../db/schema.ts";
import { matches, psychologists, slots } from "../db/schema.ts";
import { canClientChange, isPast, nowMsk } from "./datetime.ts";

/**
 * Жизненный цикл слота: free → booked → done | no_show, и обратно в free при
 * отмене. Все переходы — только отсюда: экшены кабинетов лишь узнают, кто
 * зовёт, и рассылают уведомления по возвращённым данным. База передаётся
 * параметром, поэтому модуль проверяется тестами без Next.
 */

export type Db = BetterSQLite3Database<typeof schema>;
type RunResult = { changes: number };

export type SlotRow = typeof slots.$inferSelect;
export type PsyContact = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  meetingUrl: string | null;
};

const PSY_CONTACT = {
  id: psychologists.id,
  name: psychologists.name,
  phone: psychologists.phone,
  email: psychologists.email,
  meetingUrl: psychologists.meetingUrl,
};

export async function psyContact(db: Db, id: number): Promise<PsyContact | null> {
  const [row] = await db.select(PSY_CONTACT).from(psychologists).where(eq(psychologists.id, id));
  return row ?? null;
}

/** Психолог, которого клиент выбрал из предложенных оператором. */
export async function chosenPsychologist(
  db: Db,
  clientRequestId: number,
): Promise<PsyContact | null> {
  const [row] = await db
    .select(PSY_CONTACT)
    .from(matches)
    .innerJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(
      and(
        eq(matches.clientRequestId, clientRequestId),
        eq(matches.active, true),
        eq(matches.chosen, true),
      ),
    );
  return row ?? null;
}

/** Слот, принадлежащий одному из обращений клиента, — в любом статусе. */
export async function clientSlot(
  db: Db,
  slotId: number,
  requestIds: number[],
): Promise<SlotRow | null> {
  if (requestIds.length === 0) return null;
  const [slot] = await db
    .select()
    .from(slots)
    .where(and(eq(slots.id, slotId), inArray(slots.clientRequestId, requestIds)));
  return slot ?? null;
}

export type TakeResult = { ok: true; slot: SlotRow } | { ok: false; error: string };

/**
 * Занять свободное окно. Гонку двух клиентов решает условие status='free'
 * в UPDATE: второй получит changes=0 и вежливый отказ. Ссылка на встречу
 * ставится всегда — раньше бронь от оператора оставляла клиента без неё.
 */
export async function takeSlot(
  db: Db,
  params: {
    slotId: number;
    psychologist: PsyContact;
    clientRequestId: number;
    /** true — первая встреча; не задано — как открыл психолог. */
    isIntroCall?: boolean;
    now?: Date;
  },
): Promise<TakeResult> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, params.slotId));
  if (!slot || slot.psychologistId !== params.psychologist.id) {
    return { ok: false, error: "Это время недоступно" };
  }
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };
  if (isPast(slot.startsAt, params.now)) return { ok: false, error: "Это время уже прошло" };

  const isIntroCall = params.isIntroCall ?? slot.isIntroCall;
  const meetingLink = params.psychologist.meetingUrl;
  const res = (await db
    .update(slots)
    .set({ status: "booked", clientRequestId: params.clientRequestId, isIntroCall, meetingLink })
    .where(and(eq(slots.id, params.slotId), eq(slots.status, "free")))) as unknown as RunResult;
  if (res.changes === 0) return { ok: false, error: "Это время только что заняли" };

  // Возвращаем слот таким, каким он стал, — а не до-апдейтную копию.
  return {
    ok: true,
    slot: { ...slot, status: "booked", clientRequestId: params.clientRequestId, isIntroCall, meetingLink },
  };
}

/** Бронь по заявке, когда психолог заранее неизвестен, — путь оператора. */
export async function bookSlotForRequest(
  db: Db,
  params: { slotId: number; clientRequestId: number; now?: Date },
): Promise<TakeResult> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, params.slotId));
  if (!slot) return { ok: false, error: "Окно не найдено" };
  const psy = await psyContact(db, slot.psychologistId);
  if (!psy) return { ok: false, error: "Специалист не найден" };
  return takeSlot(db, { ...params, psychologist: psy });
}

/**
 * Вернуть окно в свободные. Стирает всё клиентское: заявку, пометку первой
 * встречи, ссылку и отметку оплаты — иначе следующая бронь унаследует чужое.
 */
export async function releaseSlot(db: Db, slotId: number): Promise<void> {
  await db
    .update(slots)
    .set({
      status: "free",
      clientRequestId: null,
      isIntroCall: false,
      meetingLink: null,
      paidAt: null,
    })
    .where(eq(slots.id, slotId));
}

/**
 * Условное освобождение: срабатывает, только если бронь ещё жива. Это атомарный
 * guard против гонок «две отмены/два переноса параллельно» — вторая операция
 * получает false и не трогает уже изменённый слот.
 */
async function releaseBookedSlot(db: Db, slotId: number): Promise<boolean> {
  const res = (await db
    .update(slots)
    .set({
      status: "free",
      clientRequestId: null,
      isIntroCall: false,
      meetingLink: null,
      paidAt: null,
    })
    .where(and(eq(slots.id, slotId), eq(slots.status, "booked")))) as unknown as RunResult;
  return res.changes > 0;
}

/**
 * Отметка «сессия оплачена». Ставит и снимает её психолог — деньги приходят
 * ему напрямую, платформа лишь показывает статус клиенту.
 */
export async function setSlotPaid(
  db: Db,
  params: { slotId: number; psychologistId: number; paid: boolean; now?: Date },
): Promise<{ ok: true; slot: SlotRow } | { ok: false; error: string }> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, params.slotId));
  if (!slot || slot.psychologistId !== params.psychologistId) {
    return { ok: false, error: "Встреча не найдена" };
  }
  if (slot.status !== "booked" && slot.status !== "done") {
    return { ok: false, error: "Отметить оплату можно только у записи" };
  }

  await db
    .update(slots)
    .set({
      paidAt: params.paid
        ? (params.now ?? new Date()).toISOString().slice(0, 16).replace("T", " ")
        : null,
    })
    .where(eq(slots.id, params.slotId));
  return { ok: true, slot };
}

export type CancelResult =
  | { ok: true; slot: SlotRow; psy: PsyContact | null; late: boolean }
  | { ok: false; error: string };

/**
 * За 24 часа и раньше отмена свободная. Позже — только с явным согласием
 * клиента (allowLate): стоимость сессии удерживается, о чём его предупреждает
 * кабинет до подтверждения. Флаг обязателен и на сервере — прямой вызов
 * экшена без подтверждения не проскочит.
 */
export async function cancelClientBooking(
  db: Db,
  params: { slotId: number; requestIds: number[]; allowLate?: boolean; now?: Date },
): Promise<CancelResult> {
  const slot = await clientSlot(db, params.slotId, params.requestIds);
  if (!slot || slot.status !== "booked") return { ok: false, error: "Запись не найдена" };
  // Прошедшую встречу нельзя «отменить» задним числом — иначе клиент стирает
  // бронь до того, как специалист отметит неявку.
  if (isPast(slot.startsAt, params.now)) {
    return { ok: false, error: "Встреча уже прошла — её итог отмечает специалист" };
  }
  const late = !canClientChange(slot.startsAt, params.now);
  if (late && !params.allowLate) {
    return {
      ok: false,
      error:
        "До встречи меньше 24 часов — при отмене стоимость сессии удерживается. Подтвердите отмену в кабинете или напишите в поддержку.",
    };
  }

  if (!(await releaseBookedSlot(db, slot.id))) return { ok: false, error: "Запись не найдена" };
  return { ok: true, slot, psy: await psyContact(db, slot.psychologistId), late };
}

export type RescheduleResult =
  | { ok: true; from: SlotRow; to: SlotRow; psy: PsyContact; late: boolean }
  | { ok: false; error: string };

/**
 * Перенос: сначала занимаем новое окно и только потом освобождаем старое.
 * За 24 часа и раньше — бесплатно; позже — только с явным согласием клиента
 * (allowLate): стоимость прежней сессии удерживается.
 */
export async function rescheduleClientBooking(
  db: Db,
  params: {
    fromSlotId: number;
    toSlotId: number;
    requestIds: number[];
    allowLate?: boolean;
    now?: Date;
  },
): Promise<RescheduleResult> {
  const from = await clientSlot(db, params.fromSlotId, params.requestIds);
  if (!from || from.status !== "booked" || from.clientRequestId === null) {
    return { ok: false, error: "Запись не найдена" };
  }
  if (isPast(from.startsAt, params.now)) {
    return { ok: false, error: "Встреча уже прошла — её итог отмечает специалист" };
  }
  const late = !canClientChange(from.startsAt, params.now);
  if (late && !params.allowLate) {
    return {
      ok: false,
      error:
        "До встречи меньше 24 часов — при переносе стоимость сессии удерживается. Подтвердите перенос в кабинете или напишите в поддержку.",
    };
  }

  const psy = await psyContact(db, from.psychologistId);
  if (!psy) return { ok: false, error: "Специалист не найден" };

  const taken = await takeSlot(db, {
    slotId: params.toSlotId,
    psychologist: psy,
    clientRequestId: from.clientRequestId,
    isIntroCall: from.isIntroCall,
    now: params.now,
  });
  if (!taken.ok) return taken;

  // Старую бронь освобождаем условно: если параллельная отмена/перенос успели
  // раньше, откатываем только что занятое окно — двух броней не останется.
  if (!(await releaseBookedSlot(db, from.id))) {
    await releaseSlot(db, taken.slot.id);
    return { ok: false, error: "Запись не найдена" };
  }
  // Оплата привязана к сессии, а не к окну: при переносе она едет следом.
  if (from.paidAt) {
    await db.update(slots).set({ paidAt: from.paidAt }).where(eq(slots.id, taken.slot.id));
  }
  return { ok: true, from, to: taken.slot, psy, late };
}

/**
 * Снять все будущие брони обращения (переподбор). Прошедшие не трогаем:
 * их итог и оплату ещё должен зафиксировать специалист.
 */
export async function freeBookedSlotsOf(
  db: Db,
  clientRequestId: number,
  now?: Date,
): Promise<{ slot: SlotRow; psy: PsyContact | null }[]> {
  const booked = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.clientRequestId, clientRequestId),
        eq(slots.status, "booked"),
        gte(slots.startsAt, nowMsk(now)),
      ),
    );

  const freed: { slot: SlotRow; psy: PsyContact | null }[] = [];
  for (const slot of booked) {
    if (!(await releaseBookedSlot(db, slot.id))) continue;
    freed.push({ slot, psy: await psyContact(db, slot.psychologistId) });
  }
  return freed;
}

export type OutcomeResult = { ok: true; slot: SlotRow } | { ok: false; error: string };

/** Психолог отмечает исход прошедшей встречи. */
export async function markOutcome(
  db: Db,
  params: { slotId: number; psychologistId: number; outcome: "done" | "no_show"; now?: Date },
): Promise<OutcomeResult> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, params.slotId));
  if (!slot || slot.psychologistId !== params.psychologistId) {
    return { ok: false, error: "Встреча не найдена" };
  }
  if (slot.status !== "booked") return { ok: false, error: "Эту встречу нельзя отметить" };
  if (!isPast(slot.startsAt, params.now)) return { ok: false, error: "Встреча ещё не прошла" };

  // Условный UPDATE: параллельная попытка не перепишет уже поставленный исход.
  const res = (await db
    .update(slots)
    .set({ status: params.outcome })
    .where(and(eq(slots.id, params.slotId), eq(slots.status, "booked")))) as unknown as RunResult;
  if (res.changes === 0) return { ok: false, error: "Эту встречу нельзя отметить" };
  return { ok: true, slot };
}

/**
 * Психолог убирает своё свободное окно. Только свободное: занятое требует
 * отмены, а состоявшееся/неявка — история сессий, её не стирают (к тому же
 * на done-слот может ссылаться отзыв).
 */
export async function removePsySlot(
  db: Db,
  params: { slotId: number; psychologistId: number },
): Promise<{ ok: boolean; error?: string }> {
  const [slot] = await db.select().from(slots).where(eq(slots.id, params.slotId));
  if (!slot || slot.psychologistId !== params.psychologistId) {
    return { ok: false, error: "Слот не найден" };
  }
  if (slot.status === "booked") {
    return { ok: false, error: "На это время записан клиент — отмену согласуйте с оператором" };
  }
  if (slot.status !== "free") {
    return { ok: false, error: "Прошедшие встречи удалить нельзя — это история сессий" };
  }

  await db
    .delete(slots)
    .where(
      and(
        eq(slots.id, params.slotId),
        eq(slots.psychologistId, params.psychologistId),
        eq(slots.status, "free"),
      ),
    );
  return { ok: true };
}

export type OpenSlotsResult = { ok: true; added: number } | { ok: false; error: string };

/**
 * Психолог открывает свободные интервалы: одна дата, набор времён, опционально
 * повтор на несколько недель вперёд. Уже занятые и прошедшие времена молча
 * пропускаются — added говорит, сколько окон открылось на самом деле.
 */
export async function openSlots(
  db: Db,
  params: {
    psychologistId: number;
    date: string;
    times: string[];
    durationMin: number;
    isIntroCall: boolean;
    repeatWeeks: number;
    now?: Date;
  },
): Promise<OpenSlotsResult> {
  // Дата валидируется в оба конца: «2026-13-01» проходит регэксп, но не
  // существует, а «2027-02-31» молча превратилась бы в 3 марта.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return { ok: false, error: "Проверьте дату" };
  const base = new Date(`${params.date}T00:00:00Z`);
  if (Number.isNaN(base.getTime()) || base.toISOString().slice(0, 10) !== params.date) {
    return { ok: false, error: "Проверьте дату" };
  }

  const times = [...new Set((params.times ?? []).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))];
  if (times.length === 0) return { ok: false, error: "Добавьте хотя бы одно время" };

  const durationMin = Math.round(params.durationMin || 50);
  if (durationMin < 20 || durationMin > 180) return { ok: false, error: "Проверьте длительность" };

  const weeks = Math.min(Math.max(params.repeatWeeks || 1, 1), 8);
  const rows: (typeof slots.$inferInsert)[] = [];

  for (let w = 0; w < weeks; w++) {
    const day = new Date(base.getTime() + w * 7 * 86400000).toISOString().slice(0, 10);
    for (const time of times) {
      const startsAt = `${day}T${time}`;
      if (isPast(startsAt, params.now)) continue;
      rows.push({
        psychologistId: params.psychologistId,
        startsAt,
        durationMin,
        isIntroCall: params.isIntroCall,
      });
    }
  }

  if (rows.length === 0) return { ok: true, added: 0 };
  // Уникальный индекс (psychologist_id, starts_at) закрывает гонку двух
  // параллельных вызовов — дубликаты молча пропускаются, added честный.
  const res = (await db.insert(slots).values(rows).onConflictDoNothing()) as unknown as RunResult;
  return { ok: true, added: res.changes };
}
