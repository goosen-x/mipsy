// Платёжные провайдеры: ЮKassa и CloudPayments, тестовый контур для выбора
// одного из двух. Провайдер включается своими переменными окружения:
//   ЮKassa       — YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY (тестовый магазин)
//   CloudPayments — CLOUDPAYMENTS_PUBLIC_ID + CLOUDPAYMENTS_API_SECRET
// Без переменных кнопка провайдера не показывается.
//
// ЮKassa: платёж создаётся на сервере (POST /v3/payments), клиент уезжает на
// confirmation_url; итог приходит вебхуком payment.succeeded, подлинность
// проверяем перечитыванием платежа из API (рекомендация ЮKassa).
// CloudPayments: платёж собирает виджет на клиенте (publicId + invoiceId);
// итог приходит вебхуком pay, подпись — HMAC-SHA256 сырого тела в Content-HMAC.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type Provider = "yookassa" | "cloudpayments";

export function yookassaConfig(): { shopId: string; secretKey: string } | null {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  return shopId && secretKey ? { shopId, secretKey } : null;
}

export function cloudpaymentsConfig(): { publicId: string; apiSecret: string } | null {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  return publicId && apiSecret ? { publicId, apiSecret } : null;
}

export function enabledProviders(): Provider[] {
  const list: Provider[] = [];
  if (yookassaConfig()) list.push("yookassa");
  if (cloudpaymentsConfig()) list.push("cloudpayments");
  return list;
}

/** Тестовые ключи ЮKassa начинаются с test_ — по ним помечаем платёж тестовым. */
export function yookassaIsTest(): boolean {
  return (process.env.YOOKASSA_SECRET_KEY ?? "").startsWith("test_");
}

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function yookassaAuth(cfg: { shopId: string; secretKey: string }): string {
  return `Basic ${Buffer.from(`${cfg.shopId}:${cfg.secretKey}`).toString("base64")}`;
}

export async function createYookassaPayment(params: {
  amount: number; // рубли
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; confirmationUrl: string } | { error: string }> {
  const cfg = yookassaConfig();
  if (!cfg) return { error: "ЮKassa не настроена" };
  const res = await fetch(`${YOOKASSA_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: yookassaAuth(cfg),
      "Idempotence-Key": randomUUID(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: { value: params.amount.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: params.returnUrl },
      description: params.description,
      metadata: params.metadata,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: `ЮKassa: ${res.status} ${body.slice(0, 300)}` };
  }
  const data = (await res.json()) as {
    id: string;
    confirmation?: { confirmation_url?: string };
  };
  const url = data.confirmation?.confirmation_url;
  if (!url) return { error: "ЮKassa не вернула ссылку на оплату" };
  return { id: data.id, confirmationUrl: url };
}

/** Перечитать платёж из API — так проверяется подлинность вебхука. */
export async function getYookassaPayment(
  paymentId: string,
): Promise<{ id: string; status: string; test: boolean; metadata?: Record<string, string> } | null> {
  const cfg = yookassaConfig();
  if (!cfg) return null;
  const res = await fetch(`${YOOKASSA_API}/payments/${paymentId}`, {
    headers: { Authorization: yookassaAuth(cfg) },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    id: string;
    status: string;
    test: boolean;
    metadata?: Record<string, string>;
  };
}

/**
 * Подпись уведомления CloudPayments: base64(HMAC-SHA256(сырое тело, API Secret))
 * приходит в заголовке Content-HMAC. Чистая функция — покрыта тестом.
 */
export function verifyCloudpaymentsHmac(
  rawBody: string,
  headerHmac: string | null,
  apiSecret: string,
): boolean {
  if (!headerHmac) return false;
  const expected = createHmac("sha256", apiSecret).update(rawBody, "utf8").digest();
  let received: Buffer;
  try {
    received = Buffer.from(headerHmac, "base64");
  } catch {
    return false;
  }
  return expected.length === received.length && timingSafeEqual(expected, received);
}
