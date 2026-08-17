import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, supportTickets } from "@/db";
import { Badge } from "@/components/ui/badge";
import { TicketControls } from "../controls";
import { requireAdmin } from "../require-admin";
import { formatDbTime } from "@/lib/datetime";
import { ReplyForm } from "./reply-form";

const ROLE_LABELS: Record<string, string> = {
  client: "от клиента",
  psychologist: "от психолога",
  guest: "с сайта, без входа",
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  new: "Новое",
  in_progress: "В работе",
  closed: "Закрыто",
};

export default async function SupportPage() {
  await requireAdmin();

  const tickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  const open = tickets.filter((t) => t.status !== "closed");
  const closed = tickets.filter((t) => t.status === "closed");

  return (
    <div>
      <h1 className="text-2xl font-bold">Поддержка и жалобы</h1>
      <p className="mt-2 text-neutral-600">
        Обращения приходят из личных кабинетов. Жалобы разбираем в первую очередь: они прямо влияют
        на решение о допуске специалиста.
      </p>

      <h2 className="mt-8 text-lg font-bold">
        В работе {open.length > 0 && <Badge className="ml-2">{open.length}</Badge>}
      </h2>
      {open.length === 0 ? (
        <p className="mt-3 text-neutral-500">Открытых обращений нет.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {open.map((t) => (
            <li
              key={t.id}
              className={`rounded-2xl p-5 shadow-sm ${t.kind === "complaint" ? "border border-red-200 bg-red-50" : "bg-white"}`}
            >
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <Badge variant={t.kind === "complaint" ? "destructive" : "secondary"}>
                  {t.kind === "complaint" ? "жалоба" : "вопрос"}
                </Badge>
                <span>{ROLE_LABELS[t.fromRole] ?? t.fromRole}</span>
                <span className="font-medium text-neutral-900">{t.name}</span>
                {t.phone && (
                  <a href={`tel:${t.phone}`} className="text-brand-700 underline">
                    {t.phone}
                  </a>
                )}
                {t.email && <span>{t.email}</span>}
                {t.clientRequestId && (
                  <Link
                    href={`/admin/requests/${t.clientRequestId}`}
                    className="text-brand-700 underline"
                  >
                    заявка #{t.clientRequestId}
                  </Link>
                )}
                <span>{formatDbTime(t.createdAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line">{t.body}</p>
              {t.operatorNotes && (
                <p className="mt-2 text-xs whitespace-pre-line text-neutral-500">
                  {t.operatorNotes}
                </p>
              )}
              <div className="mt-4 space-y-3">
                <TicketControls
                  id={t.id}
                  status={t.status}
                  notes={t.operatorNotes ?? ""}
                  statusLabels={STATUS_LABELS}
                />
                {t.email ? (
                  <ReplyForm ticketId={t.id} email={t.email} />
                ) : (
                  <p className="text-xs text-neutral-400">
                    Почты нет — ответить можно только по телефону.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Закрытые</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {closed.map((t) => (
              <li key={t.id} className="rounded-xl bg-white p-4 shadow-sm">
                <span className="text-neutral-500">{formatDbTime(t.createdAt)} · </span>
                <span className="font-medium">{t.name}</span>
                <span className="text-neutral-500">
                  {" "}
                  · {t.kind === "complaint" ? "жалоба" : "вопрос"}
                </span>
                <p className="mt-1 text-neutral-600">{t.body}</p>
                {t.operatorNotes && (
                  <p className="mt-1 text-xs text-neutral-400">Итог: {t.operatorNotes}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
