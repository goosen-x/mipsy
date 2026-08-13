import "server-only";
import { eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { formatSlot, TZ_SHORT } from "./datetime";
import { buildIcs } from "./ics";
import { mailConfigured, sendMail, type MailAttachment } from "./mail";
import { logError } from "./logs";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

export type NotifyKind =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "reminder"
  | "matched"
  | "moderation"
  | "review"
  | "login";

type NotifyInput = {
  kind: NotifyKind;
  recipientRole: "client" | "psychologist";
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  subject?: string;
  body: string;
  attachments?: MailAttachment[];
  clientRequestId?: number;
  psychologistId?: number;
  slotId?: number;
};

/** SMS через smsc.ru — подключается парой переменных окружения. */
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

const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/**
 * Кладёт уведомление в очередь и пробует отправить. Письмо уходит, если задан
 * SMTP и известен адрес; иначе остаётся SMS. Неотправленное видно оператору
 * в админке с готовым текстом. Возвращает результат — вызывающему коду бывает
 * нужно знать, дошло ли (например, чтобы записать это в журнал входов).
 */
export async function notify(
  input: NotifyInput,
): Promise<{ ok: boolean; channel: "email" | "sms"; error?: string }> {
  const useEmail = Boolean(input.recipientEmail) && mailConfigured();
  const channel = useEmail ? "email" : "sms";

  const [row] = await db
    .insert(notifications)
    .values({
      kind: input.kind,
      channel,
      recipientRole: input.recipientRole,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail ?? null,
      subject: input.subject ?? null,
      body: input.body,
      clientRequestId: input.clientRequestId,
      psychologistId: input.psychologistId,
      slotId: input.slotId,
    })
    .returning({ id: notifications.id });

  const result = useEmail
    ? await sendMail({
        to: input.recipientEmail!,
        subject: input.subject ?? "mipsy",
        text: input.body,
        attachments: input.attachments,
      })
    : await sendSms(input.recipientPhone, input.body);

  if (result.ok) {
    await db
      .update(notifications)
      .set({ status: "sent", sentAt: stamp() })
      .where(eq(notifications.id, row.id));
  } else if (!result.error?.includes("не настроен")) {
    await db.update(notifications).set({ error: result.error }).where(eq(notifications.id, row.id));
    await logError({
      source: "notify",
      message: `Не удалось отправить уведомление (${channel})`,
      detail: `${input.kind} → ${input.recipientName}: ${result.error}`,
    });
  }

  return { ok: result.ok, channel, error: result.error };
}

/** Приглашение на встречу вложением — «автоматическое формирование приглашений» из ТЗ. */
export function meetingInvite(params: {
  slotId: number;
  startsAt: string;
  durationMin: number;
  psyName: string;
  meetingLink?: string | null;
}): MailAttachment {
  return {
    filename: "vstrecha-mipsy.ics",
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
    content: buildIcs({
      uid: `mipsy-slot-${params.slotId}@mipsy.mskacademy.ru`,
      startsAt: params.startsAt,
      durationMin: params.durationMin,
      summary: `Встреча с психологом ${params.psyName} (mipsy)`,
      description: params.meetingLink
        ? `Ссылка на встречу: ${params.meetingLink}\nВаш кабинет на mipsy: ${SITE_URL}/me`
        : `Ваш кабинет на mipsy: ${SITE_URL}/me`,
      url: params.meetingLink ?? `${SITE_URL}/me`,
    }),
  };
}

// Тексты уведомлений собраны здесь, чтобы их было легко вычитать целиком.
// Ссылки ведут в кабинет: человек входит по почте и коду, секрета в адресе нет.
export const messages = {
  clientBooked: (psyName: string, startsAt: string, meetingLink?: string | null) =>
    `Вы записаны к психологу ${psyName} на ${formatSlot(startsAt)}. Первая встреча бесплатная.${meetingLink ? `\n\nСсылка на встречу: ${meetingLink}` : ""}\n\nЕсли планы изменятся, встречу можно перенести или отменить не позднее чем за 24 часа в личном кабинете: ${SITE_URL}/me\n\nКоманда mipsy`,
  clientMatched: (names: string[]) =>
    names.length > 1
      ? `Мы подобрали для вас ${names.length} специалистов: ${names.join(", ")}. Посмотрите профили, выберите того, кто откликнется, и запишитесь на бесплатную первую встречу: ${SITE_URL}/me`
      : `Мы подобрали вам психолога — ${names[0]}. Выберите удобное время для бесплатной первой встречи: ${SITE_URL}/me`,
  clientRescheduled: (psyName: string, startsAt: string) =>
    `Встреча с ${psyName} перенесена на ${formatSlot(startsAt)}. Подробности в кабинете: ${SITE_URL}/me`,
  clientCancelled: (psyName: string, startsAt: string) =>
    `Встреча с ${psyName} ${formatSlot(startsAt)} отменена. Выбрать другое время: ${SITE_URL}/me`,
  clientReminder: (psyName: string, startsAt: string) =>
    `Напоминаем о встрече с ${psyName} завтра в ${startsAt.split("T")[1]} ${TZ_SHORT}.`,
  clientReview: (psyName: string) =>
    `Как прошла встреча с ${psyName}? Оцените её в личном кабинете — это помогает другим людям выбрать специалиста: ${SITE_URL}/me`,
  psyBooked: (clientName: string, startsAt: string) =>
    `К вам записался клиент ${clientName} на ${formatSlot(startsAt)}. Кабинет: ${SITE_URL}/cab`,
  psyRescheduled: (clientName: string, startsAt: string) =>
    `Клиент ${clientName} перенёс встречу на ${formatSlot(startsAt)}. Кабинет: ${SITE_URL}/cab`,
  psyCancelled: (clientName: string, startsAt: string) =>
    `Клиент ${clientName} отменил встречу ${formatSlot(startsAt)}. Время снова свободно.`,
  psyModerated: (approved: boolean) =>
    approved
      ? `Ваш профиль одобрен и опубликован. Откройте расписание, чтобы клиенты могли записаться: ${SITE_URL}/cab`
      : `По вашей заявке принято отрицательное решение. Подробности в кабинете: ${SITE_URL}/cab`,
  loginCode: (code: string) =>
    `Код для входа в личный кабинет mipsy: ${code}\n\nКод действует 15 минут. Если вы его не запрашивали — просто не вводите, доступ никто не получит.`,
  // Тот же шаг для человека, которого мы ещё не знаем: сначала он подтверждает
  // почту, и только потом узнаёт, что кабинет начинается с анкеты.
  signupCode: (code: string) =>
    `Код для подтверждения почты на mipsy: ${code}\n\nКод действует 15 минут. Кабинета с этим адресом у нас пока нет — после ввода кода мы предложим короткую анкету, чтобы подобрать вам психолога.\n\nЕсли вы этого не запрашивали, просто удалите письмо: без кода никто ничего не увидит.`,
};

export const subjects = {
  booked: "mipsy: вы записаны на встречу",
  matched: "mipsy: мы подобрали психолога",
  rescheduled: "mipsy: встреча перенесена",
  cancelled: "mipsy: встреча отменена",
  reminder: "mipsy: напоминание о встрече",
  review: "mipsy: как прошла встреча?",
  moderation: "mipsy: решение по вашей заявке",
  login: "mipsy: код для входа",
};
