// Общее завершение платежа для вебхуков обоих провайдеров: пометить платёж,
// проставить оплату на брони и написать клиенту. Идемпотентно — повторное
// уведомление о том же платеже ничего не дублирует.
import { eq } from "drizzle-orm";
import { clientRequests, db, payments, psychologists, slots } from "@/db";
import { messages, notify, subjects } from "@/lib/notify";
import { logPayment } from "@/lib/payment-log";

export async function markPaymentSucceeded(params: {
  paymentId: number;
  providerPaymentId: string;
  testMode: boolean;
}): Promise<void> {
  const [p] = await db.select().from(payments).where(eq(payments.id, params.paymentId));
  if (!p) {
    await logPayment("завершение отклонено: платёж не найден", {
      paymentId: params.paymentId,
    });
    return;
  }
  if (p.status === "succeeded") {
    await logPayment("повторное уведомление — пропущено", {
      paymentId: p.id,
      provider: p.provider,
    });
    return;
  }

  await db
    .update(payments)
    .set({
      status: "succeeded",
      providerPaymentId: params.providerPaymentId,
      testMode: params.testMode,
    })
    .where(eq(payments.id, p.id));

  const [slot] = await db.select().from(slots).where(eq(slots.id, p.slotId));
  if (!slot) return;
  if (!slot.paidAt) {
    await db
      .update(slots)
      .set({ paidAt: new Date().toISOString().slice(0, 16).replace("T", " ") })
      .where(eq(slots.id, slot.id));
  }
  await logPayment("оплата подтверждена, отметка на брони", {
    paymentId: p.id,
    provider: p.provider,
    detail: `встреча #${slot.id}, ${slot.startsAt}${params.testMode ? ", тестовый режим" : ""}`,
  });

  if (!slot.clientRequestId) return;
  const [client] = await db
    .select({
      name: clientRequests.name,
      phone: clientRequests.phone,
      email: clientRequests.email,
    })
    .from(clientRequests)
    .where(eq(clientRequests.id, slot.clientRequestId));
  const [psy] = await db
    .select({ name: psychologists.name })
    .from(psychologists)
    .where(eq(psychologists.id, slot.psychologistId));
  if (client && psy) {
    await notify({
      kind: "paid",
      recipientRole: "client",
      recipientName: client.name,
      recipientPhone: client.phone,
      recipientEmail: client.email,
      subject: subjects.paid,
      body: messages.clientPaid(psy.name, slot.startsAt),
      clientRequestId: slot.clientRequestId,
      psychologistId: slot.psychologistId,
      slotId: slot.id,
    });
  }
}

export async function markPaymentCanceled(paymentId: number): Promise<void> {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || p.status !== "pending") return;
  await db.update(payments).set({ status: "canceled" }).where(eq(payments.id, p.id));
  await logPayment("платёж отменён провайдером", { paymentId: p.id, provider: p.provider });
}
