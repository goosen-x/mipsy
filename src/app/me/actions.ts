"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, reviews, supportTickets } from "@/db";
import { accountRequestIds, currentAccountId } from "@/lib/auth";
import {
  cancelClientBooking,
  chosenPsychologist,
  clientSlot,
  freeBookedSlotsOf,
  rescheduleClientBooking,
  takeSlot,
} from "@/lib/booking";
import { meetingInvite, messages, notify, subjects } from "@/lib/notify";

type Client = { id: number; name: string; phone: string | null; email: string | null };

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
  const psy = await chosenPsychologist(db, c.id);
  if (!psy) return { ok: false, error: "Сначала выберите специалиста" };

  const taken = await takeSlot(db, { slotId, psychologist: psy, clientRequestId: c.id });
  if (!taken.ok) return taken;
  const slot = taken.slot;

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

export async function rescheduleSlot(
  fromSlotId: number,
  toSlotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

  const moved = await rescheduleClientBooking(db, {
    fromSlotId,
    toSlotId,
    requestIds: await myRequestIds(),
  });
  if (!moved.ok) return moved;
  const { to, psy } = moved;

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

  const cancelled = await cancelClientBooking(db, { slotId, requestIds: await myRequestIds() });
  if (!cancelled.ok) return cancelled;

  if (cancelled.psy) {
    const psy = cancelled.psy;
    await notify({
      kind: "cancelled",
      recipientRole: "psychologist",
      recipientName: psy.name,
      recipientPhone: psy.phone,
      recipientEmail: psy.email,
      subject: subjects.cancelled,
      body: messages.psyCancelled(c.name, cancelled.slot.startsAt),
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

  // Брони снимаются — психолог должен узнать, что время снова свободно.
  for (const freed of await freeBookedSlotsOf(db, c.id)) {
    if (!freed.psy) continue;
    await notify({
      kind: "cancelled",
      recipientRole: "psychologist",
      recipientName: freed.psy.name,
      recipientPhone: freed.psy.phone,
      recipientEmail: freed.psy.email,
      subject: subjects.cancelled,
      body: messages.psyCancelled(c.name, freed.slot.startsAt),
      clientRequestId: c.id,
      psychologistId: freed.psy.id,
      slotId: freed.slot.id,
    });
  }

  revalidatePath("/me");
  revalidatePath("/admin");
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

  const slot = await clientSlot(db, slotId, await myRequestIds());
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
  revalidatePath("/admin/reviews");
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

  const psy = await chosenPsychologist(db, c.id);
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
  revalidatePath("/admin/support");
  return { ok: true };
}
