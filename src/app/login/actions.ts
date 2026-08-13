"use server";

import { homePathFor, issueLoginCode, signIn, verifyLoginCode } from "@/lib/auth";
import { isEmail, maskEmail, normalizeEmail } from "@/lib/auth-core";
import { logLogin } from "@/lib/logs";
import { messages, notify, subjects } from "@/lib/notify";

export async function requestLoginCode(
  rawEmail: string,
): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) {
    await logLogin(email, "bad_email");
    return { ok: false, error: "Проверьте адрес почты" };
  }

  const issued = await issueLoginCode(email);
  if (!issued) {
    // Наружу об этом не говорим, но в журнале входов след остаётся: иначе на
    // «мне не приходит код» ответить нечем — письма-то и не было.
    await logLogin(email, "no_account");
  } else {
    const role = (await homePathFor(issued.accountId)) === "/cab" ? "psychologist" : "client";
    const sent = await notify({
      kind: "login",
      recipientRole: role,
      recipientName: issued.name,
      recipientPhone: issued.phone ?? "",
      recipientEmail: issued.email,
      subject: subjects.login,
      body: messages.loginCode(issued.code),
    });
    await logLogin(
      email,
      sent.ok ? "sent" : "delivery_failed",
      sent.ok ? `канал: ${sent.channel}` : `канал: ${sent.channel}, причина: ${sent.error}`,
    );
  }

  // Есть аккаунт с такой почтой или нет — ответ одинаковый: сам факт обращения
  // к психологу относится к данным особой категории и раскрывать его нельзя.
  return { ok: true, sentTo: maskEmail(email) };
}

export async function confirmLoginCode(
  rawEmail: string,
  code: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);
  const result = await verifyLoginCode(email, code);
  if (!result.ok) {
    await logLogin(email, result.reason);
    return { ok: false, error: result.error };
  }

  await signIn(result.accountId);
  await logLogin(email, "signed_in");
  return { ok: true, path: await homePathFor(result.accountId) };
}
