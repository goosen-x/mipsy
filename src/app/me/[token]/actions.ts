"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists, slots } from "@/db";
import { canClientChange, isPast } from "@/lib/datetime";
import { messages, notify } from "@/lib/notify";

type Ctx = {
  request: { id: number; name: string; phone: string; token: string };
  psychologist: { id: number; name: string; phone: string; cabinetToken: string };
};

/** Клиент по токену вместе с активным подбором — общая проверка доступа. */
async function context(token: string): Promise<Ctx | null> {
  const [row] = await db
    .select({
      id: clientRequests.id,
      name: clientRequests.name,
      phone: clientRequests.phone,
      psyId: psychologists.id,
      psyName: psychologists.name,
      psyPhone: psychologists.phone,
      psyToken: psychologists.cabinetToken,
    })
    .from(clientRequests)
    .leftJoin(
      matches,
      and(eq(matches.clientRequestId, clientRequests.id), eq(matches.active, true)),
    )
    .leftJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(eq(clientRequests.clientToken, token));
  if (!row) return null;
  return {
    request: { id: row.id, name: row.name, phone: row.phone, token },
    psychologist:
      row.psyId && row.psyName && row.psyPhone && row.psyToken
        ? { id: row.psyId, name: row.psyName, phone: row.psyPhone, cabinetToken: row.psyToken }
        : (null as unknown as Ctx["psychologist"]),
  };
}

/** Занять свободный слот. Гонку за один слот отсекает условие status = free. */
export async function bookSlot(
  token: string,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await context(token);
  if (!ctx) return { ok: false, error: "Страница не найдена" };
  if (!ctx.psychologist) return { ok: false, error: "Психолог ещё не подобран" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== ctx.psychologist.id) {
    return { ok: false, error: "Это время недоступно" };
  }
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };
  if (isPast(slot.startsAt)) return { ok: false, error: "Это время уже прошло" };

  const res = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: ctx.request.id })
    .where(and(eq(slots.id, slotId), eq(slots.status, "free")));
  if ((res as unknown as { changes: number }).changes === 0) {
    return { ok: false, error: "Это время только что заняли" };
  }

  await notify({
    kind: "booked",
    recipientRole: "psychologist",
    recipientName: ctx.psychologist.name,
    recipientPhone: ctx.psychologist.phone,
    body: messages.psyBooked(ctx.request.name, slot.startsAt, ctx.psychologist.cabinetToken),
    clientRequestId: ctx.request.id,
    psychologistId: ctx.psychologist.id,
    slotId,
  });

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

/**
 * Перенос: освобождаем старое окно и занимаем новое. Как у конкурентов —
 * не позднее чем за 24 часа до начала встречи.
 */
export async function rescheduleSlot(
  token: string,
  fromSlotId: number,
  toSlotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await context(token);
  if (!ctx) return { ok: false, error: "Страница не найдена" };
  if (!ctx.psychologist) return { ok: false, error: "Психолог ещё не подобран" };

  const [from] = await db.select().from(slots).where(eq(slots.id, fromSlotId));
  if (!from || from.clientRequestId !== ctx.request.id) {
    return { ok: false, error: "Запись не найдена" };
  }
  if (!canClientChange(from.startsAt)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — перенос согласуйте с оператором по телефону.",
    };
  }

  const [to] = await db.select().from(slots).where(eq(slots.id, toSlotId));
  if (!to || to.psychologistId !== ctx.psychologist.id || to.status !== "free") {
    return { ok: false, error: "Новое время недоступно" };
  }
  if (isPast(to.startsAt)) return { ok: false, error: "Это время уже прошло" };

  const taken = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: ctx.request.id, isIntroCall: from.isIntroCall })
    .where(and(eq(slots.id, toSlotId), eq(slots.status, "free")));
  if ((taken as unknown as { changes: number }).changes === 0) {
    return { ok: false, error: "Это время только что заняли" };
  }
  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(eq(slots.id, fromSlotId));

  await notify({
    kind: "rescheduled",
    recipientRole: "psychologist",
    recipientName: ctx.psychologist.name,
    recipientPhone: ctx.psychologist.phone,
    body: messages.psyRescheduled(ctx.request.name, to.startsAt, ctx.psychologist.cabinetToken),
    clientRequestId: ctx.request.id,
    psychologistId: ctx.psychologist.id,
    slotId: toSlotId,
  });

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

export async function cancelBooking(
  token: string,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await context(token);
  if (!ctx) return { ok: false, error: "Страница не найдена" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.clientRequestId !== ctx.request.id) {
    return { ok: false, error: "Запись не найдена" };
  }
  if (!canClientChange(slot.startsAt)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — отмену согласуйте с оператором по телефону.",
    };
  }

  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(and(eq(slots.id, slotId), eq(slots.clientRequestId, ctx.request.id)));

  if (ctx.psychologist) {
    await notify({
      kind: "cancelled",
      recipientRole: "psychologist",
      recipientName: ctx.psychologist.name,
      recipientPhone: ctx.psychologist.phone,
      body: messages.psyCancelled(ctx.request.name, slot.startsAt),
      clientRequestId: ctx.request.id,
      psychologistId: ctx.psychologist.id,
      slotId,
    });
  }

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

/** «Психолог не подошёл» — заявка возвращается оператору на переподбор. */
export async function requestRematch(
  token: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await context(token);
  if (!ctx) return { ok: false, error: "Страница не найдена" };

  await db
    .update(clientRequests)
    .set({ status: "rematch", rematchReason: String(reason ?? "").trim() || null })
    .where(eq(clientRequests.id, ctx.request.id));

  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(and(eq(slots.clientRequestId, ctx.request.id), eq(slots.status, "booked")));

  revalidatePath(`/me/${token}`);
  revalidatePath("/op");
  return { ok: true };
}
