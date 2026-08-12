"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, matches, slots } from "@/db";

async function requestByToken(token: string) {
  const [req] = await db
    .select({ id: clientRequests.id, status: clientRequests.status })
    .from(clientRequests)
    .where(eq(clientRequests.clientToken, token));
  return req ?? null;
}

// Клиент занимает свободный слот своего подобранного психолога.
export async function bookSlot(
  token: string,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const req = await requestByToken(token);
  if (!req) return { ok: false, error: "Страница не найдена" };

  const [match] = await db
    .select({ psychologistId: matches.psychologistId })
    .from(matches)
    .where(and(eq(matches.clientRequestId, req.id), eq(matches.active, true)));
  if (!match) return { ok: false, error: "Психолог ещё не подобран" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== match.psychologistId) {
    return { ok: false, error: "Это время недоступно" };
  }
  if (slot.status !== "free") return { ok: false, error: "Это время уже заняли" };

  const res = await db
    .update(slots)
    .set({ status: "booked", clientRequestId: req.id })
    .where(and(eq(slots.id, slotId), eq(slots.status, "free")));
  // better-sqlite3 возвращает число изменённых строк — защита от гонки за один слот
  if ((res as unknown as { changes: number }).changes === 0) {
    return { ok: false, error: "Это время только что заняли" };
  }

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

export async function cancelBooking(
  token: string,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  const req = await requestByToken(token);
  if (!req) return { ok: false, error: "Страница не найдена" };

  // Правило платформы: самостоятельная отмена — не позднее чем за 24 часа.
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.clientRequestId !== req.id) return { ok: false, error: "Запись не найдена" };
  const pad = (n: number) => String(n).padStart(2, "0");
  const limit = new Date(Date.now() + 24 * 3600 * 1000);
  const limitStr = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}T${pad(limit.getHours())}:${pad(limit.getMinutes())}`;
  if (slot.startsAt < limitStr) {
    return {
      ok: false,
      error: "До встречи меньше 24 часов — отмену согласуйте с оператором по телефону.",
    };
  }

  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null })
    .where(and(eq(slots.id, slotId), eq(slots.clientRequestId, req.id)));

  revalidatePath(`/me/${token}`);
  return { ok: true };
}

// «Психолог не подошёл» — заявка возвращается оператору на переподбор.
export async function requestRematch(
  token: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const req = await requestByToken(token);
  if (!req) return { ok: false, error: "Страница не найдена" };

  await db
    .update(clientRequests)
    .set({ status: "rematch", rematchReason: String(reason ?? "").trim() || null })
    .where(eq(clientRequests.id, req.id));

  // Освобождаем будущие брони клиента — встречи с прежним специалистом отменяются.
  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null })
    .where(and(eq(slots.clientRequestId, req.id), eq(slots.status, "booked")));

  revalidatePath(`/me/${token}`);
  revalidatePath("/op");
  return { ok: true };
}
