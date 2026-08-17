"use server";

import { eq } from "drizzle-orm";
import { clientRequests, db, payments, psychologists, slots } from "@/db";
import { currentAccount } from "@/lib/auth";
import { formatSlot } from "@/lib/datetime";
import { GRADES, isGrade } from "@/lib/grades";
import { logPayment } from "@/lib/payment-log";
import {
  cloudpaymentsConfig,
  createYookassaPayment,
  yookassaConfig,
  yookassaIsTest,
  type Provider,
} from "@/lib/payments";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

export type StartPaymentResult =
  | { ok: true; kind: "redirect"; url: string }
  | {
      ok: true;
      kind: "widget";
      publicId: string;
      invoiceId: string;
      amount: number;
      description: string;
      email: string;
    }
  | { ok: false; error: string };

/** Клиент запускает оплату своей брони выбранным провайдером. */
export async function startPayment(slotId: number, provider: Provider): Promise<StartPaymentResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Войдите, чтобы оплатить" };

  const [row] = await db
    .select({
      slot: slots,
      grade: psychologists.grade,
      psyName: psychologists.name,
      ownerAccountId: clientRequests.accountId,
    })
    .from(slots)
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .innerJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(eq(slots.id, slotId));

  if (!row || row.ownerAccountId !== account.id) return { ok: false, error: "Встреча не найдена" };
  if (row.slot.status !== "booked") return { ok: false, error: "Оплатить можно только запись" };
  if (row.slot.paidAt) return { ok: false, error: "Эта встреча уже оплачена" };
  if (!isGrade(row.grade)) return { ok: false, error: "Цена сессии ещё не назначена" };
  const amount = GRADES[row.grade].price;
  const description = `Сессия с психологом: ${row.psyName}, ${formatSlot(row.slot.startsAt)}`;

  const [payment] = await db
    .insert(payments)
    .values({
      slotId,
      accountId: account.id,
      amount,
      provider,
      testMode: provider === "yookassa" ? yookassaIsTest() : false,
    })
    .returning({ id: payments.id });
  await logPayment("платёж создан", {
    paymentId: payment.id,
    provider,
    detail: `${amount} ₽, ${description}, аккаунт #${account.id}`,
  });

  if (provider === "yookassa") {
    if (!yookassaConfig()) return { ok: false, error: "ЮKassa не настроена" };
    const res = await createYookassaPayment({
      amount,
      description,
      returnUrl: `${SITE_URL}/me`,
      metadata: { paymentId: String(payment.id), slotId: String(slotId) },
    });
    if ("error" in res) {
      await logPayment("провайдер отказал в создании", {
        paymentId: payment.id,
        provider,
        detail: res.error,
      });
      return { ok: false, error: res.error };
    }
    await db
      .update(payments)
      .set({ providerPaymentId: res.id })
      .where(eq(payments.id, payment.id));
    await logPayment("клиент отправлен на страницу оплаты", {
      paymentId: payment.id,
      provider,
      detail: `платёж ЮKassa ${res.id}`,
    });
    return { ok: true, kind: "redirect", url: res.confirmationUrl };
  }

  const cp = cloudpaymentsConfig();
  if (!cp) return { ok: false, error: "CloudPayments не настроен" };
  await logPayment("клиенту выдан виджет оплаты", { paymentId: payment.id, provider });
  return {
    ok: true,
    kind: "widget",
    publicId: cp.publicId,
    invoiceId: String(payment.id),
    amount,
    description,
    email: account.email,
  };
}
