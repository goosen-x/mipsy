import "server-only";
import { lt } from "drizzle-orm";
import { adminLog, db, errorLog, loginLog } from "@/db";
import { currentAccountId } from "./auth";

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

export type LoginOutcome =
  | "bad_email"
  | "no_account"
  | "sent"
  | "sent_unknown"
  | "verified_new"
  | "throttled"
  | "delivery_failed"
  | "wrong_code"
  | "expired"
  | "blocked"
  | "signed_in";

/**
 * Журнал попыток входа. Хранит введённый адрес — иначе на вопрос «почему мне
 * не приходит код» ответить нечем. Записи старше 30 дней удаляем: для разбора
 * обращений этого хватает, а лишние адреса копить незачем.
 */
export async function logLogin(
  email: string,
  outcome: LoginOutcome,
  detail?: string,
): Promise<void> {
  try {
    await db.insert(loginLog).values({
      email: email.slice(0, 200),
      outcome,
      detail: detail?.slice(0, 500) ?? null,
    });
    await db.delete(loginLog).where(lt(loginLog.createdAt, sqlDaysAgo(30)));
  } catch {
    // Журнал не должен мешать человеку войти.
  }
}

function sqlDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace("T", " ");
}

/** Журнал действий администратора: кто и что делал с данными людей. */
export async function logAdmin(
  action: string,
  target?: { type: string; id?: number; detail?: string },
): Promise<void> {
  try {
    await db.insert(adminLog).values({
      actorAccountId: await currentAccountId(),
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      detail: target?.detail?.slice(0, 1000) ?? null,
    });
  } catch {
    // Не мешаем основному действию.
  }
}
