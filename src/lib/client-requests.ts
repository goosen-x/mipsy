import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { clientRequests, db, slots } from "@/db";
import { nowMsk } from "@/lib/datetime";

// Не в actions.ts: всё, что экспортирует файл с "use server", можно вызвать
// с клиента, а эти функции принимают чужой accountId.

/** Последнее обращение аккаунта — то, что сейчас показывает кабинет. */
export async function lastRequestOf(accountId: number) {
  const [last] = await db
    .select()
    .from(clientRequests)
    .where(eq(clientRequests.accountId, accountId))
    .orderBy(desc(clientRequests.id))
    .limit(1);
  return last ?? null;
}

/** Есть ли у клиента будущая бронь по любому из его обращений. */
export async function hasUpcomingBooking(accountId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: slots.id })
    .from(slots)
    .innerJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(
      and(
        eq(clientRequests.accountId, accountId),
        eq(slots.status, "booked"),
        gte(slots.startsAt, nowMsk()),
      ),
    )
    .limit(1);
  return Boolean(row);
}
