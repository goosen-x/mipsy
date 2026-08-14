import { desc, eq } from "drizzle-orm";
import { db, loginLog, notifications } from "@/db";
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
  review: "просьба об отзыве",
  login: "код для входа",
};

// Журнал входов: что именно случилось, когда человек просил код.
const LOGIN_OUTCOMES: Record<string, { label: string; tone: string }> = {
  sent: { label: "код отправлен", tone: "bg-brand-100 text-brand-800" },
  sent_unknown: { label: "код отправлен, аккаунта ещё нет", tone: "bg-brand-100 text-brand-800" },
  verified_new: { label: "почту подтвердил, ушёл в анкету", tone: "bg-emerald-100 text-emerald-800" },
  throttled: { label: "слишком часто просит код", tone: "bg-amber-100 text-amber-900" },
  signed_in: { label: "вошёл", tone: "bg-emerald-100 text-emerald-800" },
  no_account: { label: "такой почты у нас нет", tone: "bg-amber-100 text-amber-900" },
  bad_email: { label: "адрес введён с ошибкой", tone: "bg-amber-100 text-amber-900" },
  delivery_failed: { label: "письмо не ушло", tone: "bg-red-100 text-red-800" },
  wrong_code: { label: "неверный код", tone: "bg-neutral-100 text-neutral-700" },
  expired: { label: "код просрочен", tone: "bg-neutral-100 text-neutral-700" },
  blocked: { label: "попытки исчерпаны", tone: "bg-red-100 text-red-800" },
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

  const logins = await db.select().from(loginLog).orderBy(desc(loginLog.id)).limit(30);

  const smsConfigured = Boolean(process.env.SMS_LOGIN && process.env.SMS_PASSWORD);
  const mailConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
  );

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
                {n.channel === "email" ? (
                  <span>{n.recipientEmail}</span>
                ) : (
                  n.recipientPhone && (
                    <a href={`tel:${n.recipientPhone}`} className="text-brand-700 underline">
                      {n.recipientPhone}
                    </a>
                  )
                )}
                <span>{n.createdAt.slice(0, 16)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-sm">
                {n.body}
              </p>
              {n.error && <p className="mt-2 text-xs text-red-600">Ошибка отправки: {n.error}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {n.recipientPhone && (
                  <>
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
                  </>
                )}
                <MarkSentButton id={n.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-bold">Попытки входа</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Сюда смотрим, когда человек говорит «код не приходит». Код уходит на любой корректный адрес —
        и знакомый, и новый, — поэтому здесь же видно, кто дошёл до анкеты, а кто застрял.
        {!mailConfigured && " Внимание: SMTP не настроен, письма с кодом не уходят вообще."}
      </p>
      {logins.length === 0 ? (
        <p className="mt-3 text-neutral-500">Пока никто не пробовал войти.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {logins.map((l) => {
            const outcome = LOGIN_OUTCOMES[l.outcome] ?? {
              label: l.outcome,
              tone: "bg-neutral-100 text-neutral-700",
            };
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                <span className="text-neutral-500">{l.createdAt.slice(0, 16)}</span>
                <span className="font-medium">{l.email}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${outcome.tone}`}>
                  {outcome.label}
                </span>
                {l.detail && <span className="text-xs text-neutral-400">{l.detail}</span>}
              </li>
            );
          })}
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
