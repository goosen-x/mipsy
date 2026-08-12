import { desc, eq } from "drizzle-orm";
import { db, notifications } from "@/db";
import { Badge } from "@/components/ui/badge";
import { MarkSentButton } from "../controls";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  booked: "запись",
  rescheduled: "перенос",
  cancelled: "отмена",
  reminder: "напоминание",
  matched: "подбор",
  moderation: "модерация",
};

export default async function NotificationsPage() {
  const pending = await db
    .select()
    .from(notifications)
    .where(eq(notifications.status, "pending"))
    .orderBy(desc(notifications.createdAt));
  const sent = await db
    .select()
    .from(notifications)
    .where(eq(notifications.status, "sent"))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  const smsConfigured = Boolean(process.env.SMS_LOGIN && process.env.SMS_PASSWORD);

  return (
    <div>
      <h1 className="text-2xl font-bold">Уведомления</h1>
      <p className="mt-2 text-neutral-600">
        {smsConfigured
          ? "SMS-провайдер подключён: сообщения уходят автоматически, здесь видна история."
          : "SMS-провайдер не подключён — отправляйте сообщения вручную и отмечайте их здесь. Чтобы включить автоматическую отправку, задайте SMS_LOGIN и SMS_PASSWORD при запуске контейнера."}
      </p>

      <h2 className="mt-8 text-lg font-bold">
        К отправке {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}
      </h2>
      {pending.length === 0 ? (
        <p className="mt-3 text-neutral-500">Всё отправлено.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((n) => (
            <li key={n.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <Badge variant="secondary">{KIND_LABELS[n.kind] ?? n.kind}</Badge>
                <span>{n.recipientRole === "client" ? "клиенту" : "психологу"}</span>
                <span className="font-medium text-neutral-900">{n.recipientName}</span>
                <a href={`tel:${n.recipientPhone}`} className="text-brand-700 underline">
                  {n.recipientPhone}
                </a>
                <span>{n.createdAt.slice(0, 16)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-sm">
                {n.body}
              </p>
              {n.error && <p className="mt-2 text-xs text-red-600">Ошибка отправки: {n.error}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={`sms:${n.recipientPhone}?body=${encodeURIComponent(n.body)}`}
                  className="text-sm text-brand-700 underline"
                >
                  Открыть в SMS
                </a>
                <a
                  href={`https://wa.me/${n.recipientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(n.body)}`}
                  className="text-sm text-brand-700 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <MarkSentButton id={n.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {sent.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Отправленные</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sent.map((n) => (
              <li key={n.id} className="rounded-xl bg-white p-3 shadow-sm">
                <span className="text-neutral-500">{n.sentAt ?? n.createdAt.slice(0, 16)} · </span>
                <span className="font-medium">{n.recipientName}</span>
                <span className="text-neutral-500"> · {KIND_LABELS[n.kind] ?? n.kind}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
