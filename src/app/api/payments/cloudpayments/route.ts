// Вебхук CloudPayments. Один адрес для уведомлений check и pay (настраивается
// в личном кабинете CloudPayments → Сайты → Уведомления, формат по умолчанию —
// form-urlencoded). Подпись: base64(HMAC-SHA256(сырое тело, API Secret)) в
// заголовке Content-HMAC.
//
// check — до списания: подтверждаем только свой счёт с верной суммой (code 0),
// иначе платёж отклоняется (code 10). pay — после оплаты: помечаем платёж.
import { eq } from "drizzle-orm";
import { db, payments } from "@/db";
import { logError } from "@/lib/logs";
import { logPayment } from "@/lib/payment-log";
import { cloudpaymentsConfig, verifyCloudpaymentsHmac } from "@/lib/payments";
import { markPaymentSucceeded } from "@/lib/payment-complete";

export async function POST(req: Request) {
  try {
    const cfg = cloudpaymentsConfig();
    if (!cfg) return Response.json({ code: 13 });

    const raw = await req.text();
    const hmac = req.headers.get("content-hmac") ?? req.headers.get("x-content-hmac");
    if (!verifyCloudpaymentsHmac(raw, hmac, cfg.apiSecret)) {
      await logPayment("вебхук отклонён: подпись не сошлась", { provider: "cloudpayments" });
      return new Response("bad signature", { status: 403 });
    }

    const p = new URLSearchParams(raw);
    const invoiceId = Number(p.get("InvoiceId"));
    const amount = Number(p.get("Amount"));
    const transactionId = p.get("TransactionId") ?? "";
    const status = p.get("Status"); // у check-уведомления статуса нет
    const testMode = p.get("TestMode") === "1";
    await logPayment("вебхук получен", {
      provider: "cloudpayments",
      detail: `счёт ${p.get("InvoiceId")}, статус ${status ?? "check"}, ${amount} ₽`,
    });

    if (!Number.isInteger(invoiceId)) return Response.json({ code: 10 });
    const [payment] = await db.select().from(payments).where(eq(payments.id, invoiceId));
    if (!payment || payment.provider !== "cloudpayments") {
      await logPayment("вебхук отклонён: счёт не найден", {
        provider: "cloudpayments",
        detail: `счёт ${invoiceId}`,
      });
      return Response.json({ code: 10 });
    }
    if (Math.round(amount) !== payment.amount) {
      await logPayment("вебхук отклонён: сумма не сошлась", {
        paymentId: payment.id,
        provider: "cloudpayments",
        detail: `пришло ${amount} ₽, ожидалось ${payment.amount} ₽`,
      });
      return Response.json({ code: 11 });
    }

    if (status === "Completed" || status === "Authorized") {
      await markPaymentSucceeded({
        paymentId: payment.id,
        providerPaymentId: transactionId,
        testMode,
      });
    }
    return Response.json({ code: 0 });
  } catch (e) {
    await logError({
      source: "request",
      message: "вебхук CloudPayments упал",
      detail: e,
      path: "/api/payments/cloudpayments",
    });
    return Response.json({ code: 13 });
  }
}
