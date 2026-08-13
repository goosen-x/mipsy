"use server";

import { homePathFor, issueLoginCode, signIn, verifyLoginCode } from "@/lib/auth";
import { isEmail, maskEmail, normalizeEmail } from "@/lib/auth-core";
import { messages, notify, subjects } from "@/lib/notify";

export async function requestLoginCode(
  rawEmail: string,
): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты" };

  const issued = await issueLoginCode(email);
  if (issued) {
    const role = (await homePathFor(issued.accountId)) === "/cab" ? "psychologist" : "client";
    await notify({
      kind: "login",
      recipientRole: role,
      recipientName: issued.name,
      recipientPhone: issued.phone ?? "",
      recipientEmail: issued.email,
      subject: subjects.login,
      body: messages.loginCode(issued.code),
    });
  }

  // Есть аккаунт с такой почтой или нет — ответ одинаковый: сам факт обращения
  // к психологу относится к данным особой категории и раскрывать его нельзя.
  return { ok: true, sentTo: maskEmail(email) };
}

export async function confirmLoginCode(
  rawEmail: string,
  code: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const result = await verifyLoginCode(rawEmail, code);
  if (!result.ok) return result;

  await signIn(result.accountId);
  return { ok: true, path: await homePathFor(result.accountId) };
}
