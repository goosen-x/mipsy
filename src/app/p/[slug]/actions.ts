"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists } from "@/db";
import { currentAccount, linkAccount } from "@/lib/auth";
import { takeSlot } from "@/lib/booking";
import { meetingInvite, messages, notify, subjects } from "@/lib/notify";

export type DirectBooking = {
  name: string;
  note: string;
  pdConsent: boolean;
};

/**
 * Запись напрямую из профиля/каталога: клиент сам выбрал специалиста и время.
 * Доступна после входа — почта подтверждена, бронь не попадёт в чужой кабинет.
 * Первая сессия с психологом — бесплатная (правило платформы), поэтому
 * бронь помечается как вводная.
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
    .where(and(eq(psychologists.slug, slug), eq(psychologists.moderationStatus, "approved")));
  if (!psy) return { ok: false, error: "Специалист не найден" };

  const token = randomUUID();
  const [req] = await db
    .insert(clientRequests)
    .values({
      forWhom: "self",
      accountId: account.id,
      name,
      email,
      story: data.note?.trim() || null,
      pdConsent: true,
      status: "matched",
      clientToken: token,
    })
    .returning({ id: clientRequests.id });

  // Первая сессия с психологом бесплатна (правило платформы) — бронь вводная.
  const booked = await takeSlot(db, {
    slotId,
    psychologist: psy,
    clientRequestId: req.id,
    isIntroCall: true,
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
    clientRequestId: req.id,
    psychologistId: psy.id,
    slotId,
  });

  revalidatePath(`/p/${slug}`);
  revalidatePath("/admin");
  return { ok: true };
}
