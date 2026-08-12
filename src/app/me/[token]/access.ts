"use server";

import { checkCode, grantAccess, issueCode } from "@/lib/access";
import { notify } from "@/lib/notify";

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}
function maskPhone(phone: string): string {
  return `${phone.slice(0, 2)}***${phone.slice(-4)}`;
}

export async function sendClientCode(
  token: string,
): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  const target = await issueCode("me", token);
  if (!target) return { ok: false, error: "Страница не найдена" };

  await notify({
    kind: "moderation",
    recipientRole: "client",
    recipientName: target.name,
    recipientPhone: target.phone,
    recipientEmail: target.email,
    subject: "mipsy: код для входа",
    body: `Код для входа на вашу страницу mipsy: ${target.code}\n\nЕсли вы его не запрашивали — просто не вводите код, доступ никто не получит.`,
  });

  return {
    ok: true,
    sentTo: target.email ? maskEmail(target.email) : maskPhone(target.phone),
  };
}

export async function confirmClientCode(
  token: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await checkCode("me", token, code);
  if (!ok) return { ok: false, error: "Неверный код — проверьте и попробуйте ещё раз" };
  await grantAccess("me", token);
  return { ok: true };
}
