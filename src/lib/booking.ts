import { and, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
// Расширения в путях обязательны: модуль импортируют и Next, и node --test.
import * as schema from "../db/schema.ts";
import { matches, psychologists, slots } from "../db/schema.ts";
import { canClientChange, isPast } from "./datetime.ts";

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

  const res = (await db
    .update(slots)
    .set({
      status: "booked",
      clientRequestId: params.clientRequestId,
      isIntroCall: params.isIntroCall ?? slot.isIntroCall,
      meetingLink: params.psychologist.meetingUrl,
    })
    .where(and(eq(slots.id, params.slotId), eq(slots.status, "free")))) as unknown as RunResult;
  if (res.changes === 0) return { ok: false, error: "Это время только что заняли" };

  return { ok: true, slot: { ...slot, status: "booked", clientRequestId: params.clientRequestId } };
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
 * встречи и ссылку — иначе следующая бронь могла показать чужую.
 */
export async function releaseSlot(db: Db, slotId: number): Promise<void> {
  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false, meetingLink: null })
    .where(eq(slots.id, slotId));
}

export type CancelResult =
  | { ok: true; slot: SlotRow; psy: PsyContact | null }
  | { ok: false; error: string };

export async function cancelClientBooking(
  db: Db,
  params: { slotId: number; requestIds: number[]; now?: Date },
): Promise<CancelResult> {
  const slot = await clientSlot(db, params.slotId, params.requestIds);
  if (!slot || slot.status !== "booked") return { ok: false, error: "Запись не найдена" };
  if (!canClientChange(slot.startsAt, params.now)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — отмену согласуйте с оператором через поддержку.",
    };
  }

  await releaseSlot(db, slot.id);
  return { ok: true, slot, psy: await psyContact(db, slot.psychologistId) };
}

export type RescheduleResult =
  | { ok: true; from: SlotRow; to: SlotRow; psy: PsyContact }
  | { ok: false; error: string };

/** Перенос: сначала занимаем новое окно и только потом освобождаем старое. */
export async function rescheduleClientBooking(
  db: Db,
  params: { fromSlotId: number; toSlotId: number; requestIds: number[]; now?: Date },
): Promise<RescheduleResult> {
  const from = await clientSlot(db, params.fromSlotId, params.requestIds);
  if (!from || from.status !== "booked" || from.clientRequestId === null) {
    return { ok: false, error: "Запись не найдена" };
  }
  if (!canClientChange(from.startsAt, params.now)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — перенос согласуйте с оператором через поддержку.",
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

  await releaseSlot(db, from.id);
  return { ok: true, from, to: taken.slot, psy };
}

/** Снять все брони обращения (переподбор). Возвращает, кого предупредить. */
export async function freeBookedSlotsOf(
  db: Db,
  clientRequestId: number,
): Promise<{ slot: SlotRow; psy: PsyContact | null }[]> {
  const booked = await db
    .select()
    .from(slots)
    .where(and(eq(slots.clientRequestId, clientRequestId), eq(slots.status, "booked")));

  const freed: { slot: SlotRow; psy: PsyContact | null }[] = [];
  for (const slot of booked) {
    await releaseSlot(db, slot.id);
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

  await db.update(slots).set({ status: params.outcome }).where(eq(slots.id, params.slotId));
  return { ok: true, slot };
}

/** Психолог убирает своё свободное окно. Занятое трогать нельзя. */
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

  await db
    .delete(slots)
    .where(and(eq(slots.id, params.slotId), eq(slots.psychologistId, params.psychologistId)));
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) return { ok: false, error: "Проверьте дату" };
  const times = (params.times ?? []).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  if (times.length === 0) return { ok: false, error: "Добавьте хотя бы одно время" };

  const weeks = Math.min(Math.max(params.repeatWeeks || 1, 1), 8);
  const base = new Date(`${params.date}T00:00:00Z`);
  const rows: (typeof slots.$inferInsert)[] = [];

  for (let w = 0; w < weeks; w++) {
    const day = new Date(base.getTime() + w * 7 * 86400000).toISOString().slice(0, 10);
    for (const time of times) {
      const startsAt = `${day}T${time}`;
      if (isPast(startsAt, params.now)) continue;
      rows.push({
        psychologistId: params.psychologistId,
        startsAt,
        durationMin: params.durationMin || 50,
        isIntroCall: params.isIntroCall,
      });
    }
  }

  const existing = await db
    .select({ startsAt: slots.startsAt })
    .from(slots)
    .where(eq(slots.psychologistId, params.psychologistId));
  const taken = new Set(existing.map((s) => s.startsAt));
  const fresh = rows.filter((r) => !taken.has(r.startsAt));
  if (fresh.length > 0) await db.insert(slots).values(fresh);

  return { ok: true, added: fresh.length };
}
