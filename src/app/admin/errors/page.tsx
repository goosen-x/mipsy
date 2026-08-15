import { desc, eq } from "drizzle-orm";
import { db, errorLog } from "@/db";
import { Badge } from "@/components/ui/badge";
import { MarkErrorsSeen } from "../controls";
import { requireAdmin } from "../require-admin";
import { formatDbTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  await requireAdmin();

  const unseen = await db
    .select()
    .from(errorLog)
    .where(eq(errorLog.seen, false))
    .orderBy(desc(errorLog.createdAt))
    .limit(100);
  const seen = await db
    .select()
    .from(errorLog)
    .where(eq(errorLog.seen, true))
    .orderBy(desc(errorLog.createdAt))
    .limit(30);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Журнал ошибок</h1>
        {unseen.length > 0 && <MarkErrorsSeen />}
      </div>
      <p className="mt-2 text-neutral-600">
        Сюда попадают сбои страниц, действий и отправки уведомлений. Пустой список означает, что за
        это время приложение не падало.
      </p>

      <h2 className="mt-8 text-lg font-bold">
        Новые
        {unseen.length > 0 && (
          <Badge variant="destructive" className="ml-2">
            {unseen.length}
          </Badge>
        )}
      </h2>
      {unseen.length === 0 ? (
        <p className="mt-3 text-neutral-500">Чисто.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {unseen.map((e) => (
            <li key={e.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <Badge variant="outline">{e.source}</Badge>
                <span>{formatDbTime(e.createdAt)}</span>
                {e.path && <code className="text-brand-700">{e.path}</code>}
              </div>
              <p className="mt-2 font-medium">{e.message}</p>
              {e.detail && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                  {e.detail}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      {seen.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Просмотренные</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {seen.map((e) => (
              <li key={e.id} className="rounded-xl bg-white p-3 shadow-sm">
                <span className="text-neutral-500">{formatDbTime(e.createdAt)} · </span>
                <span>{e.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
