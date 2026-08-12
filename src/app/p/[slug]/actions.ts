"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists, slots } from "@/db";
import { isPast } from "@/lib/datetime";
import { meetingInvite, messages, notify, subjects } from "@/lib/notify";

export type DirectBooking = {
  name: string;
  phone: string;
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
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const name = data.name?.trim();
  const phone = data.phone?.replace(/[^\d+]/g, "") ?? "";
  if (!name) return { ok: false, error: "Укажите имя" };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Проверьте номер телефона" };
  if (!data.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  const [psy] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      cabinetToken: psychologists.cabinetToken,
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
      name,
      phone,
      email: data.email?.trim() || null,
      story: data.note?.trim() || null,
      pdConsent: true,
      status: "matched",
      clientToken: token,
    })
    .returning({ id: clientRequests.id });

  const booked = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: req.id, isIntroCall: true })
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
    recipientPhone: phone,
    recipientEmail: data.email?.trim() || null,
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
    body: messages.psyBooked(name, slot.startsAt, psy.cabinetToken),
    clientRequestId: req.id,
    psychologistId: psy.id,
    slotId,
  });

  revalidatePath(`/p/${slug}`);
  revalidatePath("/op");
  return { ok: true, token };
}
