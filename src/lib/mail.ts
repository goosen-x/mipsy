import "server-only";
import nodemailer from "nodemailer";

export type MailAttachment = { filename: string; content: string; contentType: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

/** Адрес отправителя без имени — показываем тому, кто ищет письмо в спаме. */
export function senderAddress(): string | null {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

/**
 * Отправка письма через SMTP (nodemailer). Пока переменные не заданы,
 * письма копятся в очереди уведомлений и оператор отправляет их вручную.
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!mailConfigured()) return { ok: false, error: "почта не настроена" };

  try {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM ?? `mipsy <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      attachments: params.attachments,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "сбой отправки" };
  }
}
