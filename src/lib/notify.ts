import "server-only";
import { eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { formatSlot, TZ_SHORT } from "./datetime";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

export type NotifyKind =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "reminder"
  | "matched"
  | "moderation";

type NotifyInput = {
  kind: NotifyKind;
  recipientRole: "client" | "psychologist";
  recipientName: string;
  recipientPhone: string;
  body: string;
  clientRequestId?: number;
  psychologistId?: number;
  slotId?: number;
};

/**
 * Отправка SMS. Провайдер подключается переменными окружения; пока их нет,
 * уведомление остаётся в очереди со статусом pending — оператор отправляет
 * его вручную из админки, где для этого есть готовый текст и ссылка.
 */
async function sendSms(phone: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const login = process.env.SMS_LOGIN;
  const password = process.env.SMS_PASSWORD;
  if (!login || !password) return { ok: false, error: "провайдер не настроен" };

  const url = new URL("https://smsc.ru/sys/send.php");
  url.searchParams.set("login", login);
  url.searchParams.set("psw", password);
  url.searchParams.set("phones", phone);
  url.searchParams.set("mes", body);
  url.searchParams.set("fmt", "3");
  if (process.env.SMS_SENDER) url.searchParams.set("sender", process.env.SMS_SENDER);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as { id?: number; error?: string };
    if (data.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "сбой отправки" };
  }
}

/** Кладёт уведомление в очередь и пробует отправить сразу. */
export async function notify(input: NotifyInput): Promise<void> {
  const [row] = await db
    .insert(notifications)
    .values({
      kind: input.kind,
      recipientRole: input.recipientRole,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      body: input.body,
      clientRequestId: input.clientRequestId,
      psychologistId: input.psychologistId,
      slotId: input.slotId,
    })
    .returning({ id: notifications.id });

  const sent = await sendSms(input.recipientPhone, input.body);
  if (sent.ok) {
    await db
      .update(notifications)
      .set({ status: "sent", sentAt: new Date().toISOString().slice(0, 16).replace("T", " ") })
      .where(eq(notifications.id, row.id));
  } else if (sent.error !== "провайдер не настроен") {
    await db.update(notifications).set({ error: sent.error }).where(eq(notifications.id, row.id));
  }
}

// Тексты уведомлений собраны здесь, чтобы их было легко вычитать целиком.
export const messages = {
  clientBooked: (psyName: string, startsAt: string, token: string) =>
    `mipsy: вы записаны к психологу ${psyName} на ${formatSlot(startsAt)}. Первая встреча бесплатная. Ваша страница: ${SITE_URL}/me/${token}`,
  clientMatched: (psyName: string, token: string) =>
    `mipsy: мы подобрали вам психолога — ${psyName}. Выберите удобное время: ${SITE_URL}/me/${token}`,
  clientRescheduled: (psyName: string, startsAt: string, token: string) =>
    `mipsy: встреча с ${psyName} перенесена на ${formatSlot(startsAt)}. Подробности: ${SITE_URL}/me/${token}`,
  clientCancelled: (psyName: string, startsAt: string, token: string) =>
    `mipsy: встреча с ${psyName} ${formatSlot(startsAt)} отменена. Выбрать другое время: ${SITE_URL}/me/${token}`,
  clientReminder: (psyName: string, startsAt: string) =>
    `mipsy: напоминаем о встрече с ${psyName} завтра в ${startsAt.split("T")[1]} ${TZ_SHORT}.`,
  psyBooked: (clientName: string, startsAt: string, token: string) =>
    `mipsy: к вам записался клиент ${clientName} на ${formatSlot(startsAt)}. Кабинет: ${SITE_URL}/cab/${token}`,
  psyRescheduled: (clientName: string, startsAt: string, token: string) =>
    `mipsy: клиент ${clientName} перенёс встречу на ${formatSlot(startsAt)}. Кабинет: ${SITE_URL}/cab/${token}`,
  psyCancelled: (clientName: string, startsAt: string) =>
    `mipsy: клиент ${clientName} отменил встречу ${formatSlot(startsAt)}. Время снова свободно.`,
  psyModerated: (approved: boolean, token: string) =>
    approved
      ? `mipsy: ваш профиль одобрен и опубликован. Откройте расписание, чтобы клиенты могли записаться: ${SITE_URL}/cab/${token}`
      : `mipsy: по вашей заявке принято отрицательное решение. Подробности в кабинете: ${SITE_URL}/cab/${token}`,
};
