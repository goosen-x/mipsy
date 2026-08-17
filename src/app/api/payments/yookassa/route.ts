// Вебхук ЮKassa (события payment.succeeded / payment.canceled).
// Подлинность: тело не принимается на веру — платёж перечитывается из API
// ЮKassa с нашим секретом (рекомендация документации). Отвечаем 200 всегда,
// иначе ЮKassa будет ретраить сутки.
import { logError } from "@/lib/logs";
import { logPayment } from "@/lib/payment-log";
import { getYookassaPayment } from "@/lib/payments";
import { markPaymentCanceled, markPaymentSucceeded } from "@/lib/payment-complete";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      event?: string;
      object?: { id?: string };
    } | null;
    const providerId = body?.object?.id;
    if (!providerId) {
      await logPayment("вебхук отклонён: нет id платежа", { provider: "yookassa" });
      return Response.json({ ok: false }, { status: 200 });
    }
    await logPayment("вебхук получен", {
      provider: "yookassa",
      detail: `${body?.event ?? "без события"}, платёж ЮKassa ${providerId}`,
    });

    const payment = await getYookassaPayment(providerId);
    const paymentId = Number(payment?.metadata?.paymentId);
    if (!payment || !Number.isInteger(paymentId)) {
      await logPayment("вебхук отклонён: платёж не подтвердился в API ЮKassa", {
        provider: "yookassa",
        detail: `платёж ЮKassa ${providerId}`,
      });
      return Response.json({ ok: false }, { status: 200 });
    }
    await logPayment("платёж перечитан из API, подлинный", {
      paymentId,
      provider: "yookassa",
      detail: `статус у провайдера: ${payment.status}`,
    });

    if (payment.status === "succeeded") {
      await markPaymentSucceeded({
        paymentId,
        providerPaymentId: payment.id,
        testMode: payment.test,
      });
    } else if (payment.status === "canceled") {
      await markPaymentCanceled(paymentId);
    }
    return Response.json({ ok: true });
  } catch (e) {
    await logError({
      source: "request",
      message: "вебхук ЮKassa упал",
      detail: e,
      path: "/api/payments/yookassa",
    });
    return Response.json({ ok: false }, { status: 200 });
  }
}
