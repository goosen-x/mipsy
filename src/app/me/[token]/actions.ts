"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists, reviews, slots, supportTickets } from "@/db";
import { canClientChange, isPast } from "@/lib/datetime";
import { meetingInvite, messages, notify, subjects } from "@/lib/notify";

type Client = { id: number; name: string; phone: string; email: string | null; token: string };
type Psy = { id: number; name: string; phone: string; email: string | null; cabinetToken: string };

async function client(token: string): Promise<Client | null> {
  const [row] = await db
    .select({
      id: clientRequests.id,
      name: clientRequests.name,
      phone: clientRequests.phone,
      email: clientRequests.email,
    })
    .from(clientRequests)
    .where(eq(clientRequests.clientToken, token));
  return row ? { ...row, token } : null;
}

/** Психолог, которого клиент выбрал из предложенных. */
async function chosenPsy(clientRequestId: number): Promise<Psy | null> {
  const [row] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      cabinetToken: psychologists.cabinetToken,
    })
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

/** Клиент выбирает одного из предложенных специалистов. */
export async function choosePsychologist(
  token: string,
  psychologistId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };

  const [proposal] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.clientRequestId, c.id),
        eq(matches.psychologistId, psychologistId),
        eq(matches.active, true),
      ),
    );
  if (!proposal) return { ok: false, error: "Этот специалист вам не предлагался" };

  await db
    .update(matches)
    .set({ chosen: false })
    .where(and(eq(matches.clientRequestId, c.id), eq(matches.active, true)));
  await db.update(matches).set({ chosen: true }).where(eq(matches.id, proposal.id));

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

export async function bookSlot(
  token: string,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };
  const psy = await chosenPsy(c.id);
  if (!psy) return { ok: false, error: "Сначала выберите специалиста" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== psy.id) return { ok: false, error: "Это время недоступно" };
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };
  if (isPast(slot.startsAt)) return { ok: false, error: "Это время уже прошло" };

  const res = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: c.id })
    .where(and(eq(slots.id, slotId), eq(slots.status, "free")));
  if ((res as unknown as { changes: number }).changes === 0) {
    return { ok: false, error: "Это время только что заняли" };
  }

  await notify({
    kind: "booked",
    recipientRole: "client",
    recipientName: c.name,
    recipientPhone: c.phone,
    recipientEmail: c.email,
    subject: subjects.booked,
    body: messages.clientBooked(psy.name, slot.startsAt, token),
    attachments: [
      meetingInvite({
        slotId,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        psyName: psy.name,
        clientToken: token,
      }),
    ],
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId,
  });
  await notify({
    kind: "booked",
    recipientRole: "psychologist",
    recipientName: psy.name,
    recipientPhone: psy.phone,
    recipientEmail: psy.email,
    subject: subjects.booked,
    body: messages.psyBooked(c.name, slot.startsAt, psy.cabinetToken),
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId,
  });

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

/** Перенос: занимаем новое окно и только потом освобождаем старое. */
export async function rescheduleSlot(
  token: string,
  fromSlotId: number,
  toSlotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };
  const psy = await chosenPsy(c.id);
  if (!psy) return { ok: false, error: "Психолог не выбран" };

  const [from] = await db.select().from(slots).where(eq(slots.id, fromSlotId));
  if (!from || from.clientRequestId !== c.id) return { ok: false, error: "Запись не найдена" };
  if (!canClientChange(from.startsAt)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — перенос согласуйте с оператором по телефону.",
    };
  }

  const [to] = await db.select().from(slots).where(eq(slots.id, toSlotId));
  if (!to || to.psychologistId !== psy.id || to.status !== "free") {
    return { ok: false, error: "Новое время недоступно" };
  }
  if (isPast(to.startsAt)) return { ok: false, error: "Это время уже прошло" };

  const taken = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: c.id, isIntroCall: from.isIntroCall })
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
    recipientRole: "client",
    recipientName: c.name,
    recipientPhone: c.phone,
    recipientEmail: c.email,
    subject: subjects.rescheduled,
    body: messages.clientRescheduled(psy.name, to.startsAt, token),
    attachments: [
      meetingInvite({
        slotId: toSlotId,
        startsAt: to.startsAt,
        durationMin: to.durationMin,
        psyName: psy.name,
        clientToken: token,
      }),
    ],
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId: toSlotId,
  });
  await notify({
    kind: "rescheduled",
    recipientRole: "psychologist",
    recipientName: psy.name,
    recipientPhone: psy.phone,
    recipientEmail: psy.email,
    subject: subjects.rescheduled,
    body: messages.psyRescheduled(c.name, to.startsAt, psy.cabinetToken),
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId: toSlotId,
  });

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

export async function cancelBooking(
  token: string,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.clientRequestId !== c.id) return { ok: false, error: "Запись не найдена" };
  if (!canClientChange(slot.startsAt)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — отмену согласуйте с оператором по телефону.",
    };
  }

  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(and(eq(slots.id, slotId), eq(slots.clientRequestId, c.id)));

  const psy = await chosenPsy(c.id);
  if (psy) {
    await notify({
      kind: "cancelled",
      recipientRole: "psychologist",
      recipientName: psy.name,
      recipientPhone: psy.phone,
      recipientEmail: psy.email,
      subject: subjects.cancelled,
      body: messages.psyCancelled(c.name, slot.startsAt),
      clientRequestId: c.id,
      psychologistId: psy.id,
      slotId,
    });
  }

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

export async function requestRematch(
  token: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };

  await db
    .update(clientRequests)
    .set({ status: "rematch", rematchReason: String(reason ?? "").trim() || null })
    .where(eq(clientRequests.id, c.id));
  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(and(eq(slots.clientRequestId, c.id), eq(slots.status, "booked")));

  revalidatePath(`/me/${token}`);
  revalidatePath("/op");
  return { ok: true };
}

/** Отзыв о состоявшейся встрече. Публикуется после модерации. */
export async function leaveReview(
  token: string,
  slotId: number,
  rating: number,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Поставьте оценку от 1 до 5" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.clientRequestId !== c.id) return { ok: false, error: "Встреча не найдена" };
  if (slot.status !== "done") {
    return { ok: false, error: "Отзыв можно оставить после состоявшейся встречи" };
  }

  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.slotId, slotId));
  if (existing) return { ok: false, error: "Отзыв об этой встрече уже оставлен" };

  await db.insert(reviews).values({
    psychologistId: slot.psychologistId,
    clientRequestId: c.id,
    slotId,
    rating,
    body: String(body ?? "").trim() || null,
    authorName: c.name,
  });

  revalidatePath(`/me/${token}`);
  revalidatePath("/op/reviews");
  return { ok: true };
}

/** Обращение в поддержку или жалоба. */
export async function createTicket(
  token: string,
  kind: "question" | "complaint",
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client(token);
  if (!c) return { ok: false, error: "Страница не найдена" };
  const text = String(body ?? "").trim();
  if (text.length < 5) return { ok: false, error: "Опишите, что случилось" };

  const psy = await chosenPsy(c.id);
  await db.insert(supportTickets).values({
    fromRole: "client",
    kind,
    name: c.name,
    phone: c.phone,
    email: c.email,
    body: text,
    clientRequestId: c.id,
    psychologistId: psy?.id,
  });

  revalidatePath(`/me/${token}`);
  revalidatePath("/op/support");
  return { ok: true };
}
