"use server";

import { gt, sql } from "drizzle-orm";
import { db, errorLog } from "@/db";
import { logError } from "@/lib/logs";

/**
 * Вызывается из экрана ошибки на клиенте. Экшен анонимный, поэтому ограничен:
 * не больше 20 записей в минуту на всю платформу — иначе журнал ошибок можно
 * залить мусором простым циклом запросов.
 */
export async function reportClientError(
  message: string,
  digest?: string,
  path?: string,
): Promise<void> {
  const minuteAgo = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace("T", " ");
  const [recent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(errorLog)
    .where(gt(errorLog.createdAt, minuteAgo));
  if ((recent?.count ?? 0) >= 20) return;

  await logError({
    source: "request",
    message: String(message ?? "Ошибка на странице").slice(0, 500),
    detail: digest ? `digest: ${String(digest).slice(0, 100)}` : undefined,
    path: path ? String(path).slice(0, 300) : undefined,
  });
}
