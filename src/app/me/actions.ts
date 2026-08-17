"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { accounts, clientRequests, db, matches, reviews, supportTickets } from "@/db";
import { accountRequestIds, currentAccountId } from "@/lib/auth";
import {
  cancelClientBooking,
  chosenPsychologist,
  clientSlot,
  freeBookedSlotsOf,
  rescheduleClientBooking,
  takeSlot,
} from "@/lib/booking";
import { deactivateMatches } from "@/lib/matching";
import { meetingCancel, meetingInvite, messages, notify, psyMeetingInvite, subjects } from "@/lib/notify";

type Client = { id: number; name: string; phone: string | null; email: string | null };

const NO_SESSION = { ok: false, error: "Войдите в кабинет заново" } as const;

/**
 * Текущее обращение вошедшего человека — самое свежее. Контакты добираются из
 * аккаунта: заявка могла быть создана без телефона (бронь из каталога) или со
 * старой почтой, а источник правды о контактах — аккаунт.
 */
async function client(): Promise<Client | null> {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  const [row] = await db
    .select({
      id: clientRequests.id,
      name: clientRequests.name,
      phone: clientRequests.phone,
      email: clientRequests.email,
      accountPhone: accounts.phone,
      accountEmail: accounts.email,
    })
    .from(clientRequests)
    .innerJoin(accounts, eq(clientRequests.accountId, accounts.id))
    .where(eq(clientRequests.accountId, accountId))
    .orderBy(desc(clientRequests.id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? row.accountPhone,
    email: row.accountEmail ?? row.email,
  };
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
        clientRequestId: c.id,
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
    attachments: [
      psyMeetingInvite({
        slotId,
        clientRequestId: c.id,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        clientName: c.name,
        meetingLink: psy.meetingUrl,
      }),
    ],
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
  // Подтверждение «стоимость прежней сессии удерживается» при переносе <24ч.
  allowLate = false,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

  const moved = await rescheduleClientBooking(db, {
    fromSlotId,
    toSlotId,
    requestIds: await myRequestIds(),
    allowLate,
  });
  if (!moved.ok) return moved;
  const { from, to, psy } = moved;

  // К письму о переносе — два вложения: отзыв старого события (METHOD:CANCEL,
  // UID прежней брони) и приглашение на новое время. Иначе в календаре
  // получателя остаются обе встречи.
  await notify({
    kind: "rescheduled",
    recipientRole: "client",
    recipientName: c.name,
    recipientPhone: c.phone,
    recipientEmail: c.email,
    subject: subjects.rescheduled,
    body: messages.clientRescheduled(psy.name, to.startsAt),
    attachments: [
      meetingCancel({
        slotId: from.id,
        clientRequestId: c.id,
        startsAt: from.startsAt,
        durationMin: from.durationMin,
        forRole: "client",
        otherName: psy.name,
      }),
      meetingInvite({
        slotId: toSlotId,
        clientRequestId: c.id,
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
    body: moved.late
      ? messages.psyRescheduledLate(c.name, to.startsAt)
      : messages.psyRescheduled(c.name, to.startsAt),
    attachments: [
      meetingCancel({
        slotId: from.id,
        clientRequestId: c.id,
        startsAt: from.startsAt,
        durationMin: from.durationMin,
        forRole: "psychologist",
        otherName: c.name,
      }),
      psyMeetingInvite({
        slotId: toSlotId,
        clientRequestId: c.id,
        startsAt: to.startsAt,
        durationMin: to.durationMin,
        clientName: c.name,
        meetingLink: psy.meetingUrl,
      }),
    ],
    clientRequestId: c.id,
    psychologistId: psy.id,
    slotId: toSlotId,
  });

  revalidatePath("/me");
  return { ok: true };
}

export async function cancelBooking(
  slotId: number,
  // Подтверждение «стоимость сессии удерживается» при отмене <24ч.
  allowLate = false,
): Promise<{ ok: boolean; error?: string }> {
  const c = await client();
  if (!c) return NO_SESSION;

  const cancelled = await cancelClientBooking(db, {
    slotId,
    requestIds: await myRequestIds(),
    allowLate,
  });
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
      body: cancelled.late
        ? messages.psyCancelledLate(c.name, cancelled.slot.startsAt)
        : messages.psyCancelled(c.name, cancelled.slot.startsAt),
      attachments: [
        meetingCancel({
          slotId,
          clientRequestId: c.id,
          startsAt: cancelled.slot.startsAt,
          durationMin: cancelled.slot.durationMin,
          forRole: "psychologist",
          otherName: c.name,
        }),
      ],
      clientRequestId: c.id,
      psychologistId: psy.id,
      slotId,
    });
  }

  // Подтверждение клиенту: он и так знает об отмене, но письмо несёт отзыв
  // события — иначе встреча остаётся висеть в его календаре.
  await notify({
    kind: "cancelled",
    recipientRole: "client",
    recipientName: c.name,
    recipientPhone: c.phone,
    recipientEmail: c.email,
    subject: subjects.cancelled,
    body: messages.clientCancelled(cancelled.psy?.name ?? "специалистом", cancelled.slot.startsAt),
    attachments: [
      meetingCancel({
        slotId,
        clientRequestId: c.id,
        startsAt: cancelled.slot.startsAt,
        durationMin: cancelled.slot.durationMin,
        forRole: "client",
        otherName: cancelled.psy?.name,
      }),
    ],
    clientRequestId: c.id,
    psychologistId: cancelled.slot.psychologistId,
    slotId,
  });

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
  // Прежние предложения гаснут: иначе старый психолог остаётся «выбранным»,
  // занимает лимит подборки и продолжает показываться в кабинете.
  await deactivateMatches(db, c.id);

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
      attachments: [
        meetingCancel({
          slotId: freed.slot.id,
          clientRequestId: c.id,
          startsAt: freed.slot.startsAt,
          durationMin: freed.slot.durationMin,
          forRole: "psychologist",
          otherName: c.name,
        }),
      ],
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
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Поставьте оценку от 1 до 5" };
  }

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

  // Уникальный индекс на slot_id — последняя линия обороны от двойного отзыва
  // при двух параллельных запросах (check-then-insert их не ловит).
  try {
    await db.insert(reviews).values({
      psychologistId: slot.psychologistId,
      clientRequestId: slot.clientRequestId ?? c.id,
      slotId,
      rating,
      body: String(body ?? "").trim().slice(0, 2000) || null,
      authorName: c.name,
    });
  } catch {
    return { ok: false, error: "Отзыв об этой встрече уже оставлен" };
  }

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
  const text = String(body ?? "").trim().slice(0, 4000);
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
