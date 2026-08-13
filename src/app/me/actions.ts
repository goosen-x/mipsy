"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists, reviews, slots, supportTickets } from "@/db";
import { accountRequestIds, currentAccountId } from "@/lib/auth";
import { canClientChange, isPast } from "@/lib/datetime";
import { meetingInvite, messages, notify, subjects } from "@/lib/notify";

type Client = { id: number; name: string; phone: string | null; email: string | null };
type Psy = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  meetingUrl: string | null;
};

const NO_SESSION = { ok: false, error: "Войдите в кабинет заново" } as const;

/** Текущее обращение вошедшего человека — самое свежее. */
async function client(): Promise<Client | null> {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  const [row] = await db
    .select({
      id: clientRequests.id,
      name: clientRequests.name,
      phone: clientRequests.phone,
      email: clientRequests.email,
    })
    .from(clientRequests)
    .where(eq(clientRequests.accountId, accountId))
    .orderBy(desc(clientRequests.id))
    .limit(1);
  return row ?? null;
}

/** Все обращения аккаунта: запись могла остаться от прошлого подбора. */
async function myRequestIds(): Promise<number[]> {
  const accountId = await currentAccountId();
  return accountId ? accountRequestIds(accountId) : [];
}

async function psyById(id: number): Promise<Psy | null> {
  const [row] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      meetingUrl: psychologists.meetingUrl,
    })
    .from(psychologists)
    .where(eq(psychologists.id, id));
  return row ?? null;
}

/** Психолог, которого клиент выбрал из предложенных. */
async function chosenPsy(clientRequestId: number): Promise<Psy | null> {
  const [row] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      meetingUrl: psychologists.meetingUrl,
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

/** Запись принадлежит вошедшему человеку — по любому из его обращений. */
async function myBooking(slotId: number) {
  const ids = await myRequestIds();
  if (ids.length === 0) return null;
  const [slot] = await db
    .select()
    .from(slots)
    .where(and(eq(slots.id, slotId), inArray(slots.clientRequestId, ids)));
  return slot ?? null;
}

/** Клиент выбирает одного из предложенных специалистов. */
export async function choosePsychologist(
  psychologistId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

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

  revalidatePath("/me");
  return { ok: true };
}

export async function bookSlot(slotId: number): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;
  const psy = await chosenPsy(c.id);
  if (!psy) return { ok: false, error: "Сначала выберите специалиста" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== psy.id) return { ok: false, error: "Это время недоступно" };
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };
  if (isPast(slot.startsAt)) return { ok: false, error: "Это время уже прошло" };

  const res = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: c.id, meetingLink: psy.meetingUrl })
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
    body: messages.clientBooked(psy.name, slot.startsAt, psy.meetingUrl),
    attachments: [
      meetingInvite({
        slotId,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        psyName: psy.name,
        meetingLink: psy.meetingUrl,
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
    body: messages.psyBooked(c.name, slot.startsAt),
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId,
  });

  revalidatePath("/me");
  return { ok: true };
}

/** Перенос: занимаем новое окно и только потом освобождаем старое. */
export async function rescheduleSlot(
  fromSlotId: number,
  toSlotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

  const from = await myBooking(fromSlotId);
  if (!from) return { ok: false, error: "Запись не найдена" };
  if (!canClientChange(from.startsAt)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — перенос согласуйте с оператором через поддержку.",
    };
  }

  const psy = await psyById(from.psychologistId);
  if (!psy) return { ok: false, error: "Специалист не найден" };

  const [to] = await db.select().from(slots).where(eq(slots.id, toSlotId));
  if (!to || to.psychologistId !== psy.id || to.status !== "free") {
    return { ok: false, error: "Новое время недоступно" };
  }
  if (isPast(to.startsAt)) return { ok: false, error: "Это время уже прошло" };

  const taken = await db
    .update(slots)
    .set({
      status: "booked",
      clientRequestId: from.clientRequestId,
      isIntroCall: from.isIntroCall,
      meetingLink: psy.meetingUrl,
    })
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
    body: messages.clientRescheduled(psy.name, to.startsAt),
    attachments: [
      meetingInvite({
        slotId: toSlotId,
        startsAt: to.startsAt,
        durationMin: to.durationMin,
        psyName: psy.name,
        meetingLink: psy.meetingUrl,
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
    body: messages.psyRescheduled(c.name, to.startsAt),
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId: toSlotId,
  });

  revalidatePath("/me");
  return { ok: true };
}

export async function cancelBooking(slotId: number): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

  const slot = await myBooking(slotId);
  if (!slot) return { ok: false, error: "Запись не найдена" };
  if (!canClientChange(slot.startsAt)) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — отмену согласуйте с оператором через поддержку.",
    };
  }

  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(eq(slots.id, slotId));

  const psy = await psyById(slot.psychologistId);
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

  revalidatePath("/me");
  return { ok: true };
}

export async function requestRematch(reason: string): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

  await db
    .update(clientRequests)
    .set({ status: "rematch", rematchReason: String(reason ?? "").trim() || null })
    .where(eq(clientRequests.id, c.id));
  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null, isIntroCall: false })
    .where(and(eq(slots.clientRequestId, c.id), eq(slots.status, "booked")));

  revalidatePath("/me");
  revalidatePath("/op");
  return { ok: true };
}

/** Отзыв о состоявшейся встрече. Публикуется после модерации. */
export async function leaveReview(
  slotId: number,
  rating: number,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Поставьте оценку от 1 до 5" };

  const slot = await myBooking(slotId);
  if (!slot) return { ok: false, error: "Встреча не найдена" };
  if (slot.status !== "done") {
    return { ok: false, error: "Отзыв можно оставить после состоявшейся встречи" };
  }

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.slotId, slotId));
  if (existing) return { ok: false, error: "Отзыв об этой встрече уже оставлен" };

  await db.insert(reviews).values({
    psychologistId: slot.psychologistId,
    clientRequestId: slot.clientRequestId ?? c.id,
    slotId,
    rating,
    body: String(body ?? "").trim() || null,
    authorName: c.name,
  });

  revalidatePath("/me");
  revalidatePath("/op/reviews");
  return { ok: true };
}

/** Обращение в поддержку или жалоба. */
export async function createTicket(
  kind: "question" | "complaint",
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;
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

  revalidatePath("/me");
  revalidatePath("/op/support");
  return { ok: true };
}
