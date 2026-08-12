"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, psychologists, slots } from "@/db";

export type DirectBooking = {
  name: string;
  phone: string;
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
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(and(eq(psychologists.slug, slug), eq(psychologists.moderationStatus, "approved")));
  if (!psy) return { ok: false, error: "Специалист не найден" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== psy.id) return { ok: false, error: "Это время недоступно" };
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };

  const token = randomUUID();
  const [req] = await db
    .insert(clientRequests)
    .values({
      forWhom: "self",
      name,
      phone,
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

  revalidatePath(`/p/${slug}`);
  revalidatePath("/op");
  return { ok: true, token };
}
