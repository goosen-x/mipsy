"use server";

import {
  accountExists,
  codeRequestsThrottled,
  homePathFor,
  isEmailHidden,
  issueLoginCode,
  issueSignupCode,
  signIn,
  verifyLoginCode,
  verifySignupCode,
} from "@/lib/auth";
import { isEmail, maskEmail, normalizeEmail } from "@/lib/auth-core";
import { logLogin } from "@/lib/logs";
import { messages, notify, subjects } from "@/lib/notify";

/**
 * Вход и регистрация — один шаг (sign-in-or-up). Код уходит на любой корректный
 * адрес, поэтому по экрану нельзя понять, есть у нас такой человек или нет.
 * Развилка происходит уже после того, как он доказал, что почта его.
 */
export async function requestLoginCode(
  rawEmail: string,
): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) {
    await logLogin(email, "bad_email");
    return { ok: false, error: "Проверьте адрес почты" };
  }

  // Адрес мог быть введён кем угодно — чужой ящик засыпать письмами нельзя.
  if (await codeRequestsThrottled(email)) {
    await logLogin(email, "throttled");
    return {
      ok: false,
      error:
        "Мы уже отправили несколько писем на этот адрес. Проверьте почту и папку «Спам» — новый код можно запросить через час.",
    };
  }

  // Скрытый аккаунт: делаем вид, что письмо ушло, — снаружи это неотличимо
  // от обычного входа, но код не выписывается и не отправляется.
  if (await isEmailHidden(email)) {
    await logLogin(email, "hidden");
    return { ok: true, sentTo: maskEmail(email) };
  }

  const issued = await issueLoginCode(email);
  const sent = issued
    ? await notify({
        kind: "login",
        recipientRole: (await homePathFor(issued.accountId)) === "/cab" ? "psychologist" : "client",
        recipientName: issued.name,
        recipientPhone: issued.phone ?? "",
        recipientEmail: issued.email,
        subject: subjects.login,
        body: messages.loginCode(issued.code),
      })
    : await sendSignupCode(email);

  await logLogin(
    email,
    sent.ok ? (issued ? "sent" : "sent_unknown") : "delivery_failed",
    sent.ok ? `канал: ${sent.channel}` : `канал: ${sent.channel}, причина: ${sent.error}`,
  );

  return { ok: true, sentTo: maskEmail(email) };
}

async function sendSignupCode(email: string) {
  const code = await issueSignupCode(email);
  if (!code) return { ok: false, channel: "email" as const, error: "не удалось выписать код" };
  return notify({
    kind: "login",
    recipientRole: "client",
    recipientName: email.split("@")[0],
    recipientPhone: "",
    recipientEmail: email,
    subject: subjects.login,
    body: messages.signupCode(code),
  });
}

export async function confirmLoginCode(
  rawEmail: string,
  code: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);

  // Развилка ровно здесь: почта подтверждена — значит можно и решить, куда вести.
  if (await accountExists(email)) {
    const result = await verifyLoginCode(email, code);
    if (!result.ok) {
      await logLogin(email, result.reason);
      return { ok: false, error: result.error };
    }
    await signIn(result.accountId);
    await logLogin(email, "signed_in");
    return { ok: true, path: await homePathFor(result.accountId) };
  }

  const fresh = await verifySignupCode(email, code);
  if (!fresh.ok) {
    await logLogin(email, fresh.reason);
    return { ok: false, error: fresh.error };
  }
  await signIn(fresh.accountId);
  await logLogin(email, "verified_new");
  // Новый человек попадает в свой кабинет — подбор психолога запускается оттуда кнопкой.
  return { ok: true, path: "/me" };
}
