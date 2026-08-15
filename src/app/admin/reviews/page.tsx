import { desc, eq } from "drizzle-orm";
import { db, psychologists, reviews } from "@/db";
import { Badge } from "@/components/ui/badge";
import { ReviewModeration } from "../controls";
import { requireAdmin } from "../require-admin";
import { formatDbTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: reviews.id,
      createdAt: reviews.createdAt,
      rating: reviews.rating,
      body: reviews.body,
      authorName: reviews.authorName,
      status: reviews.status,
      psyName: psychologists.name,
    })
    .from(reviews)
    .innerJoin(psychologists, eq(reviews.psychologistId, psychologists.id))
    .orderBy(desc(reviews.createdAt));

  const pending = rows.filter((r) => r.status === "pending");
  const rest = rows.filter((r) => r.status !== "pending");

  return (
    <div>
      <h1 className="text-2xl font-bold">Отзывы</h1>
      <p className="mt-2 text-neutral-600">
        Отзыв виден на странице психолога только после публикации. Отклоняйте те, где есть контакты,
        персональные данные третьих лиц или содержание сессии.
      </p>

      <h2 className="mt-8 text-lg font-bold">
        На модерации {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}
      </h2>
      {pending.length === 0 ? (
        <p className="mt-3 text-neutral-500">Новых отзывов нет.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {pending.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span className="text-accent-500">{"★".repeat(r.rating)}</span>
                <span className="font-medium text-neutral-900">{r.authorName}</span>
                <span>о специалисте {r.psyName}</span>
                <span>{formatDbTime(r.createdAt)}</span>
              </div>
              {r.body && <p className="mt-2 whitespace-pre-line">{r.body}</p>}
              <div className="mt-4">
                <ReviewModeration id={r.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Обработанные</h2>
          <ul className="mt-3 space-y-2">
            {rest.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.status === "published" ? "secondary" : "destructive"}>
                    {r.status === "published" ? "опубликован" : "отклонён"}
                  </Badge>
                  <span className="text-accent-500">{"★".repeat(r.rating)}</span>
                  <span className="font-medium">{r.authorName}</span>
                  <span className="text-neutral-500">о {r.psyName}</span>
                </div>
                {r.body && <p className="mt-1 text-neutral-600">{r.body}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
