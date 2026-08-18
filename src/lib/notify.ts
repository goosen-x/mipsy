import "server-only";
import { eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { formatSlot, TZ_SHORT } from "./datetime";
import { bookingUid, buildCancelIcs, buildIcs } from "./ics";
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
  | "paid"
  | "rematch"
  | "no_show"
  | "login"
  | "support"
  | "outcome";

type NotifyInput = {
  kind: NotifyKind;
  recipientRole: "client" | "psychologist";
  recipientName: string;
  recipientPhone?: string | null;
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
      recipientPhone: input.recipientPhone ?? "",
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
    : input.recipientPhone
      ? await sendSms(input.recipientPhone, input.body)
      : { ok: false, error: "нет ни почты, ни телефона" };

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
  clientRequestId: number | null;
  startsAt: string;
  durationMin: number;
  psyName: string;
  meetingLink?: string | null;
}): MailAttachment {
  return {
    filename: "vstrecha-mipsy.ics",
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
    content: buildIcs({
      uid: bookingUid(params.slotId, params.clientRequestId),
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

/** То же приглашение глазами психолога: в его календаре событие — «сессия с клиентом». */
export function psyMeetingInvite(params: {
  slotId: number;
  clientRequestId: number | null;
  startsAt: string;
  durationMin: number;
  clientName: string;
  meetingLink?: string | null;
}): MailAttachment {
  return {
    filename: "sessiya-mipsy.ics",
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
    content: buildIcs({
      uid: bookingUid(params.slotId, params.clientRequestId),
      startsAt: params.startsAt,
      durationMin: params.durationMin,
      summary: `Сессия: ${params.clientName} (mipsy)`,
      description: params.meetingLink
        ? `Ссылка на встречу: ${params.meetingLink}\nКабинет: ${SITE_URL}/cab`
        : `Кабинет: ${SITE_URL}/cab`,
      url: params.meetingLink ?? `${SITE_URL}/cab`,
    }),
  };
}

/**
 * Отзыв приглашения при отмене или переносе — тот же UID, METHOD:CANCEL.
 * Вкладывается в письмо об отмене; календарь получателя убирает событие.
 */
export function meetingCancel(params: {
  slotId: number;
  clientRequestId: number | null;
  startsAt: string;
  durationMin: number;
  forRole: "client" | "psychologist";
  otherName?: string;
}): MailAttachment {
  const summary =
    params.forRole === "client"
      ? `Встреча с психологом${params.otherName ? ` ${params.otherName}` : ""} (mipsy)`
      : `Сессия: ${params.otherName ?? "клиент"} (mipsy)`;
  return {
    filename: "otmena-mipsy.ics",
    contentType: "text/calendar; charset=utf-8; method=CANCEL",
    content: buildCancelIcs({
      uid: bookingUid(params.slotId, params.clientRequestId),
      startsAt: params.startsAt,
      durationMin: params.durationMin,
      summary,
      description: "Встреча отменена.",
    }),
  };
}

// Тексты уведомлений собраны здесь, чтобы их было легко вычитать целиком.
// Ссылки ведут в кабинет: человек входит по почте и коду, секрета в адресе нет.
export const messages = {
  clientBooked: (psyName: string, startsAt: string, meetingLink?: string | null) =>
    `Вы записаны к психологу ${psyName} на ${formatSlot(startsAt)}.${meetingLink ? `\n\nСсылка на встречу: ${meetingLink}` : ""}\n\nЕсли планы изменятся, перенести или отменить встречу бесплатно можно не позднее чем за 24 часа в личном кабинете: ${SITE_URL}/me — позже стоимость сессии удерживается.\n\nКоманда mipsy`,
  clientMatched: (names: string[]) =>
    names.length > 1
      ? `Мы подобрали для вас ${names.length} специалистов: ${names.join(", ")}. Посмотрите профили, выберите того, кто откликнется, и запишитесь на встречу: ${SITE_URL}/me`
      : `Мы подобрали вам психолога — ${names[0]}. Выберите удобное время для первой встречи: ${SITE_URL}/me`,
  clientRescheduled: (psyName: string, startsAt: string) =>
    `Встреча с ${psyName} перенесена на ${formatSlot(startsAt)}. Подробности в кабинете: ${SITE_URL}/me`,
  clientCancelled: (psyName: string, startsAt: string) =>
    `Встреча с ${psyName} ${formatSlot(startsAt)} отменена. Выбрать другое время: ${SITE_URL}/me`,
  // Не «завтра в HH:MM»: у встреч сразу после полуночи напоминание уходит в тот же день.
  clientReminder: (psyName: string, startsAt: string) =>
    `Напоминаем о встрече с ${psyName} — ${formatSlot(startsAt)}. Подробности в кабинете: ${SITE_URL}/me`,
  clientReview: (psyName: string) =>
    `Как прошла встреча с ${psyName}? Оцените её в личном кабинете — это помогает другим людям выбрать специалиста: ${SITE_URL}/me`,
  clientSurvey: (psyName: string, startsAt: string) =>
    `Вчера у вас была назначена встреча с ${psyName} (${formatSlot(startsAt)}). Как она прошла? Оцените её в личном кабинете: ${SITE_URL}/me\n\nЕсли встреча не состоялась или что-то пошло не так — ответьте через форму поддержки, разберёмся: ${SITE_URL}/support`,
  psyOutcomeNudge: (clientName: string, startsAt: string) =>
    `Встреча с клиентом ${clientName} (${formatSlot(startsAt)}) прошла, но её итог не отмечен. Отметьте в кабинете, состоялась ли она: ${SITE_URL}/cab — от этого зависят напоминания клиенту и учёт оплат.`,
  psyBooked: (clientName: string, startsAt: string) =>
    `К вам записался клиент ${clientName} на ${formatSlot(startsAt)}. Кабинет: ${SITE_URL}/cab`,
  psyRescheduled: (clientName: string, startsAt: string) =>
    `Клиент ${clientName} перенёс встречу на ${formatSlot(startsAt)}. Кабинет: ${SITE_URL}/cab`,
  psyCancelled: (clientName: string, startsAt: string) =>
    `Клиент ${clientName} отменил встречу ${formatSlot(startsAt)}. Время снова свободно.`,
  psyCancelledLate: (clientName: string, startsAt: string) =>
    `Клиент ${clientName} отменил встречу ${formatSlot(startsAt)} менее чем за 24 часа. По правилам платформы стоимость сессии удерживается — клиент оплачивает её вам, как обычную. Время снова свободно.`,
  psyRescheduledLate: (clientName: string, startsAt: string) =>
    `Клиент ${clientName} перенёс встречу на ${formatSlot(startsAt)} менее чем за 24 часа до прежнего времени. По правилам платформы стоимость прежней сессии удерживается — клиент оплачивает её вам, как обычную. Кабинет: ${SITE_URL}/cab`,
  clientPsyRetired: () =>
    `К сожалению, ваш специалист больше не принимает на платформе. Ближайшие записи отменены, оплаченные сессии не сгорают — мы уже подбираем вам нового психолога, подборка появится в кабинете: ${SITE_URL}/me\n\nЕсли есть вопросы — напишите в поддержку из кабинета, разберём лично.\n\nКоманда mipsy`,
  clientNoShow: (psyName: string, startsAt: string) =>
    `Специалист ${psyName} отметил, что встреча ${formatSlot(startsAt)} не состоялась (неявка). Если это ошибка или у вас был форс-мажор — напишите в поддержку из кабинета, разберёмся: ${SITE_URL}/me`,
  psySlotFreed: (clientName: string, startsAt: string) =>
    `Оператор платформы снял запись клиента ${clientName} на ${formatSlot(startsAt)}. Время снова свободно. Вопросы — ответом на это письмо.`,
  clientPaid: (psyName: string, startsAt: string) =>
    `Оплата получена: специалист подтвердил оплату сессии ${formatSlot(startsAt)} с ${psyName}. Ждём вас на встрече!\n\nВаши записи: ${SITE_URL}/me\n\nКоманда mipsy`,
  psyModerated: (approved: boolean) =>
    approved
      ? `Ваш профиль одобрен и опубликован. Откройте расписание, чтобы клиенты могли записаться: ${SITE_URL}/cab`
      : `По вашей заявке принято отрицательное решение. Подробности в кабинете: ${SITE_URL}/cab`,
  loginCode: (code: string) =>
    `Код для входа в личный кабинет mipsy: ${code}\n\nКод действует 15 минут. Если вы его не запрашивали — просто не вводите, доступ никто не получит.`,
  // Тот же шаг для человека, которого мы ещё не знаем: сначала он подтверждает
  // почту, и только после кода открывается кабинет, откуда запускается подбор.
  signupCode: (code: string) =>
    `Код для подтверждения почты на mipsy: ${code}\n\nКод действует 15 минут. Кабинета с этим адресом у нас пока нет — после ввода кода он создастся, и вы сможете запустить подбор психолога.\n\nЕсли вы этого не запрашивали, просто удалите письмо: без кода никто ничего не увидит.`,
};

export const subjects = {
  booked: "mipsy: вы записаны на встречу",
  matched: "mipsy: мы подобрали психолога",
  rescheduled: "mipsy: встреча перенесена",
  cancelled: "mipsy: встреча отменена",
  reminder: "mipsy: напоминание о встрече",
  review: "mipsy: как прошла встреча?",
  paid: "mipsy: оплата сессии получена",
  rematch: "mipsy: подбираем вам нового специалиста",
  noShow: "mipsy: встреча не состоялась",
  moderation: "mipsy: решение по вашей заявке",
  login: "mipsy: код для входа",
  support: "mipsy: ответ поддержки",
  outcome: "mipsy: отметьте итог встречи",
};
