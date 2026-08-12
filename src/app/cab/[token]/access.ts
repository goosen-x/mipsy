"use server";

import { checkCode, grantAccess, issueCode } from "@/lib/access";
import { notify } from "@/lib/notify";

function mask(value: string, isEmail: boolean): string {
  if (!isEmail) return `${value.slice(0, 2)}***${value.slice(-4)}`;
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

export async function sendPsyCode(
  token: string,
): Promise<{ ok: boolean; sentTo?: string; error?: string }> {
  const target = await issueCode("cab", token);
  if (!target) return { ok: false, error: "Кабинет не найден" };

  await notify({
    kind: "moderation",
    recipientRole: "psychologist",
    recipientName: target.name,
    recipientPhone: target.phone,
    recipientEmail: target.email,
    subject: "mipsy: код для входа в кабинет",
    body: `Код для входа в кабинет mipsy: ${target.code}\n\nЕсли вы его не запрашивали — просто не вводите код.`,
  });

  return {
    ok: true,
    sentTo: target.email ? mask(target.email, true) : mask(target.phone, false),
  };
}

export async function confirmPsyCode(
  token: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await checkCode("cab", token, code);
  if (!ok) return { ok: false, error: "Неверный код — проверьте и попробуйте ещё раз" };
  await grantAccess("cab", token);
  return { ok: true };
}
