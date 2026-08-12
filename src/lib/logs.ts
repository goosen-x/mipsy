import "server-only";
import { adminLog, db, errorLog } from "@/db";

/** Журнал ошибок приложения — читается в админке, чтобы не лезть в docker logs. */
export async function logError(params: {
  source: "request" | "action" | "notify" | "job";
  message: string;
  detail?: unknown;
  path?: string;
}): Promise<void> {
  try {
    const detail =
      params.detail instanceof Error
        ? `${params.detail.name}: ${params.detail.message}\n${params.detail.stack ?? ""}`
        : params.detail != null
          ? String(params.detail)
          : null;
    await db.insert(errorLog).values({
      source: params.source,
      message: params.message.slice(0, 500),
      detail: detail?.slice(0, 4000) ?? null,
      path: params.path ?? null,
    });
  } catch {
    // Журнал не должен ронять запрос, который и так уже сломался.
  }
}

/** Журнал действий администратора: что оператор делал с данными людей. */
export async function logAdmin(
  action: string,
  target?: { type: string; id?: number; detail?: string },
): Promise<void> {
  try {
    await db.insert(adminLog).values({
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      detail: target?.detail?.slice(0, 1000) ?? null,
    });
  } catch {
    // Не мешаем основному действию.
  }
}
