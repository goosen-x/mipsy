"use server";

import { logError } from "@/lib/logs";

/** Вызывается из экрана ошибки на клиенте. */
export async function reportClientError(
  message: string,
  digest?: string,
  path?: string,
): Promise<void> {
  await logError({
    source: "request",
    message: message || "Ошибка на странице",
    detail: digest ? `digest: ${digest}` : undefined,
    path,
  });
}
