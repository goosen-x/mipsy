// Журнал платёжных событий: пишет шаг в payment_log и дублирует в stdout
// контейнера — процесс виден и в /admin/payments, и в docker logs.
import { db, paymentLog } from "@/db";

export async function logPayment(
  event: string,
  params: { paymentId?: number; provider?: string; detail?: string } = {},
): Promise<void> {
  const tag = [
    params.paymentId != null ? `#${params.paymentId}` : null,
    params.provider ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  console.log(`[payment] ${event}${tag ? ` (${tag})` : ""}${params.detail ? ` — ${params.detail}` : ""}`);
  try {
    await db.insert(paymentLog).values({
      paymentId: params.paymentId ?? null,
      provider: params.provider ?? null,
      event,
      detail: params.detail?.slice(0, 1000) ?? null,
    });
  } catch {
    // Журнал не должен ломать платёж.
  }
}
