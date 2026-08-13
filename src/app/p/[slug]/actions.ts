"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists, slots } from "@/db";
import { adoptSession, linkAccount } from "@/lib/auth";
import { isEmail, normalizeEmail } from "@/lib/auth-core";
import { isPast } from "@/lib/datetime";
import { meetingInvite, messages, notify, subjects } from "@/lib/notify";

export type DirectBooking = {
  name: string;
  email: string;
  note: string;
  pdConsent: boolean;
};

/**
 * Запись напрямую из профиля/каталога: клиент сам выбрал специалиста и время.
 * Первая сессия с психологом — бесплатная (правило платформы), поэтому
 * бронь помечается как вводная.
 */
export async function bookFirstSession(
  slug: string,
  slotId: number,
  data: DirectBooking,
): Promise<{ ok: true; needsLogin: boolean } | { ok: false; error: string }> {
  const name = data.name?.trim();
  const email = normalizeEmail(data.email);
  if (!name) return { ok: false, error: "Укажите имя" };
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты — по нему вы будете входить в кабинет" };
  if (!data.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  const account = await linkAccount({ email, name });
  if (!account) return { ok: false, error: "Проверьте адрес почты" };

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

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== psy.id) return { ok: false, error: "Это время недоступно" };
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };
  if (isPast(slot.startsAt)) return { ok: false, error: "Это время уже прошло" };

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

  const booked = await db
    .update(slots)
    .set({
      status: "booked",
      clientRequestId: req.id,
      isIntroCall: true,
      meetingLink: psy.meetingUrl,
    })
    .where(and(eq(slots.id, slotId), eq(slots.status, "free")));
  if ((booked as unknown as { changes: number }).changes === 0) {
    await db.delete(clientRequests).where(eq(clientRequests.id, req.id));
    return { ok: false, error: "Это время только что заняли, выберите другое" };
  }

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

  const signedIn = await adoptSession(account);
  revalidatePath(`/p/${slug}`);
  revalidatePath("/op");
  return { ok: true, needsLogin: !signedIn };
}
