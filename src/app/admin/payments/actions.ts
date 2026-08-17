"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, payments, psychologists, slots } from "@/db";
import { isPast } from "@/lib/datetime";
import { logAdmin } from "@/lib/logs";
import { requireAdmin } from "../require-admin";

/**
 * Отметить выплату психологу. Список платежей пересчитывается на сервере —
 * помечаются только те, что реально готовы к выплате прямо сейчас: успешные,
 * невыплаченные, за состоявшиеся встречи этого специалиста с живой оплатой.
 * Присланные из формы id не участвуют — подделать состав выплаты нельзя.
 */
export async function markPayoutDone(
  psychologistId: number,
): Promise<{ ok: true; count: number; amount: number } | { ok: false; error: string }> {
  await requireAdmin();

  const [psy] = await db
    .select({ id: psychologists.id, name: psychologists.name })
    .from(psychologists)
    .where(eq(psychologists.id, psychologistId));
  if (!psy) return { ok: false, error: "Специалист не найден" };

  const rows = await db
    .select({ payment: payments, slot: slots })
    .from(payments)
    .innerJoin(slots, eq(payments.slotId, slots.id))
    .where(
      and(
        eq(payments.status, "succeeded"),
        isNull(payments.paidOutAt),
        eq(slots.psychologistId, psychologistId),
      ),
    );

  const now = new Date();
  const ready = rows.filter(
    ({ slot }) =>
      isPast(slot.startsAt, now) &&
      slot.paidAt !== null &&
      (slot.status === "booked" || slot.status === "done"),
  );
  if (ready.length === 0) return { ok: false, error: "Нечего выплачивать" };

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  await db
    .update(payments)
    .set({ paidOutAt: stamp })
    .where(
      inArray(
        payments.id,
        ready.map(({ payment }) => payment.id),
      ),
    );

  const amount = ready.reduce((sum, { payment }) => sum + payment.amount, 0);
  await logAdmin("отметил выплату психологу", {
    type: "psychologist",
    id: psy.id,
    detail: `${ready.length} платежей на ${amount} ₽`,
  });
  return { ok: true, count: ready.length, amount };
}
