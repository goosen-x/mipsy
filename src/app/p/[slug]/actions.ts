"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists } from "@/db";
import { claimRole, currentAccount, linkAccount } from "@/lib/auth";
import { takeSlot } from "@/lib/booking";
import { meetingInvite, messages, notify, psyMeetingInvite, subjects } from "@/lib/notify";

export type DirectBooking = {
  name: string;
  note: string;
  pdConsent: boolean;
};

/**
 * Запись напрямую из профиля/каталога: клиент сам выбрал специалиста и время.
 * Доступна после входа — почта подтверждена, бронь не попадёт в чужой кабинет.
 */
export async function bookFirstSession(
  slug: string,
  slotId: number,
  data: DirectBooking,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Войдите на сайт, чтобы записаться" };

  const name = data.name?.trim();
  const email = account.email;
  if (!name) return { ok: false, error: "Укажите имя" };
  if (!data.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  // Одна почта — один кабинет: специалист не записывается к коллеге со своего
  // рабочего адреса, иначе на аккаунте снова окажутся обе роли.
  const conflict = await claimRole(account.id, "client");
  if (conflict) return { ok: false, error: conflict };

  // Имя аккаунта могло быть заглушкой из адреса почты — бронь его уточняет.
  await linkAccount({ email, name });

  const [psy] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      meetingUrl: psychologists.meetingUrl,
    })
    .from(psychologists)
    .where(
      and(
        eq(psychologists.slug, slug),
        eq(psychologists.moderationStatus, "approved"),
        eq(psychologists.hidden, false),
      ),
    );
  if (!psy) return { ok: false, error: "Специалист не найден" };

  const token = randomUUID();
  const [req] = await db
    .insert(clientRequests)
    .values({
      forWhom: "self",
      accountId: account.id,
      name,
      email,
      // Телефон известен из аккаунта (если человек оставлял его в анкете) —
      // иначе уведомления по этой заявке навсегда остались бы без SMS-канала.
      phone: account.phone,
      story: data.note?.trim().slice(0, 4000) || null,
      pdConsent: true,
      status: "matched",
      clientToken: token,
    })
    .returning({ id: clientRequests.id });

  const booked = await takeSlot(db, {
    slotId,
    psychologist: psy,
    clientRequestId: req.id,
  });
  if (!booked.ok) {
    await db.delete(clientRequests).where(eq(clientRequests.id, req.id));
    return booked;
  }
  const slot = booked.slot;

  await db.insert(matches).values({
    clientRequestId: req.id,
    psychologistId: psy.id,
    note: "выбрал сам в каталоге",
    // Клиент выбрал специалиста сам — в кабинете он сразу «ваш психолог»,
    // без повторного шага выбора.
    chosen: true,
  });

  await notify({
    kind: "booked",
    recipientRole: "client",
    recipientName: name,
    recipientEmail: email,
    subject: subjects.booked,
    body: messages.clientBooked(psy.name, slot.startsAt, psy.meetingUrl),
    attachments: [
      meetingInvite({
        slotId,
        clientRequestId: req.id,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        psyName: psy.name,
        meetingLink: psy.meetingUrl,
      }),
    ],
    clientRequestId: req.id,
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
    body: messages.psyBooked(name, slot.startsAt),
    attachments: [
      psyMeetingInvite({
        slotId,
        clientRequestId: req.id,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        clientName: name,
        meetingLink: psy.meetingUrl,
      }),
    ],
    clientRequestId: req.id,
    psychologistId: psy.id,
    slotId,
  });

  revalidatePath(`/p/${slug}`);
  revalidatePath("/admin");
  return { ok: true };
}
