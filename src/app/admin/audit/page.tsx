import { desc, eq } from "drizzle-orm";
import { accounts, adminLog, db } from "@/db";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "../require-admin";
import { formatDbTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: adminLog.id,
      createdAt: adminLog.createdAt,
      action: adminLog.action,
      targetType: adminLog.targetType,
      targetId: adminLog.targetId,
      detail: adminLog.detail,
      actorName: accounts.name,
    })
    .from(adminLog)
    .leftJoin(accounts, eq(adminLog.actorAccountId, accounts.id))
    .orderBy(desc(adminLog.createdAt))
    .limit(300);

  return (
    <div>
      <h1 className="text-2xl font-bold">Журнал действий</h1>
      <p className="mt-2 text-neutral-600">
        Кто из админов что делал с данными клиентов и психологов. При работе с данными о здоровье
        такой журнал обязателен: он показывает, кто и когда менял статусы, подбирал специалистов,
        публиковал отзывы и разбирал жалобы. У записей времён общего пароля имени нет.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-neutral-500">Пока пусто.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-2.5 text-sm"
            >
              <span className="text-neutral-400">{formatDbTime(r.createdAt)}</span>
              <span className="font-medium">{r.actorName ?? "—"}</span>
              <Badge variant="secondary">{r.action}</Badge>
              {r.targetType && (
                <span className="text-neutral-500">
                  {r.targetType}
                  {r.targetId != null && ` #${r.targetId}`}
                </span>
              )}
              {r.detail && <span className="text-neutral-700">{r.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
