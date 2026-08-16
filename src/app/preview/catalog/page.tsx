import Link from "next/link";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, psychologists, reviews, slots, topics } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site";
import { formatSlot, nowMsk } from "@/lib/datetime";
import { gradePriceLabel } from "@/lib/grades";

export const metadata = { title: "Превью каталога — mipsy" };
export const dynamic = "force-dynamic";

// Служебная страница выбора редизайна каталога: три варианта из ресёрча
// katalog-ux на живых данных. Никуда с сайта не ссылается; удалить после решения.

type Psy = typeof psychologists.$inferSelect;

const VARIANTS = [
  { v: "1", title: "Список с досье", ref: "как у Ясно" },
  { v: "2", title: "Слот решает", ref: "как у Zocdoc" },
  { v: "3", title: "Фото ведёт", ref: "как у Airbnb и Preply" },
] as const;

function firstSentence(text: string | null): string | null {
  if (!text) return null;
  const s = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  return s.length > 10 ? (s.length > 140 ? `${s.slice(0, 137)}…` : s) : null;
}

function Photo({ p, className, big }: { p: Psy; className: string; big?: boolean }) {
  if (p.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.photoUrl} alt={p.name} className={`${className} object-cover`} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-brand-100 font-bold text-brand-700 ${big ? "text-6xl" : "text-2xl"}`}
    >
      {p.name.slice(0, 1)}
    </div>
  );
}

export default async function CatalogPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v = "1" } = await searchParams;

  const list = await db
    .select()
    .from(psychologists)
    .where(and(eq(psychologists.moderationStatus, "approved"), eq(psychologists.hidden, false)));
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const topicTitle = (slug: string) => topicList.find((t) => t.slug === slug)?.title ?? slug;

  const ratings =
    list.length > 0
      ? await db
          .select({
            psychologistId: reviews.psychologistId,
            avg: sql<number>`avg(${reviews.rating})`,
            count: sql<number>`count(*)`,
          })
          .from(reviews)
          .where(
            and(
              eq(reviews.status, "published"),
              inArray(reviews.psychologistId, list.map((p) => p.id)),
            ),
          )
          .groupBy(reviews.psychologistId)
      : [];

  const free =
    list.length > 0
      ? await db
          .select({
            psychologistId: slots.psychologistId,
            startsAt: slots.startsAt,
          })
          .from(slots)
          .where(
            and(
              eq(slots.status, "free"),
              gte(slots.startsAt, nowMsk()),
              inArray(slots.psychologistId, list.map((p) => p.id)),
            ),
          )
          .orderBy(asc(slots.startsAt))
      : [];

  const slotsOf = (id: number) => free.filter((s) => s.psychologistId === id);
  const ratingOf = (id: number) => ratings.find((r) => r.psychologistId === id);
  const nearestLine = (id: number) => {
    const s = slotsOf(id);
    return s.length === 0 ? null : { label: formatSlot(s[0].startsAt), count: s.length };
  };
  // Для варианта 2: времена ближайшего дня с окнами.
  const nearestDay = (id: number) => {
    const s = slotsOf(id);
    if (s.length === 0) return null;
    const day = s[0].startsAt.slice(0, 10);
    const times = s.filter((x) => x.startsAt.startsWith(day));
    return {
      // formatSlot → «14 августа, пт, 11:00 МСК»; для заголовка дня время отрезаем.
      dateLabel: formatSlot(times[0].startsAt).replace(/,\s*\d{2}:\d{2}.*$/, ""),
      times: times.slice(0, 3).map((x) => x.startsAt.slice(11, 16)),
      more: Math.max(0, s.length - Math.min(times.length, 3)),
    };
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Служебный превью редизайна каталога — три варианта из ресёрча katalog-ux на живых
          данных. Страница нигде не публикуется; когда выберете вариант — внедрим его на
          /catalog, а превью удалим.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {VARIANTS.map((x) => (
            <Link
              key={x.v}
              href={`/preview/catalog?v=${x.v}`}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                v === x.v
                  ? "bg-brand-600 text-white"
                  : "border border-neutral-200 text-neutral-700 hover:border-brand-400"
              }`}
            >
              Вариант {x.v}: {x.title} <span className="opacity-70">({x.ref})</span>
            </Link>
          ))}
        </div>

        <h1 className="mt-8 text-3xl font-bold">Наши психологи</h1>
        <p className="mt-2 text-neutral-600">
          {v === "2"
            ? "Выберите удобное время — запись сразу из каталога."
            : "Стоимость видна сразу, запись — в два клика."}
        </p>

        {/* Вариант 1: вертикальный список с досье */}
        {v === "1" && (
          <div className="mt-6 space-y-4">
            {list.map((p) => {
              const r = ratingOf(p.id);
              const near = nearestLine(p.id);
              const say = firstSentence(p.about);
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-5 rounded-2xl border border-neutral-200 p-5 sm:flex-row"
                >
                  <Photo p={p} className="h-32 w-28 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/p/${p.slug}`} className="text-lg font-bold hover:text-brand-700">
                        {p.name}
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ Диплом проверен
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-neutral-600">
                      {p.experienceYears != null && <span>Опыт {p.experienceYears} лет</span>}
                      {p.approach && <span>{p.approach}</span>}
                      <span className="font-semibold text-neutral-900">
                        Сессия 50 мин · {gradePriceLabel(p.grade) ?? "цена уточняется"}
                      </span>
                    </div>
                    {say && <p className="mt-2 text-sm text-neutral-600 italic">«{say}»</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      {(p.topicSlugs ?? []).slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">
                          {topicTitle(s)}
                        </span>
                      ))}
                      {(p.topicSlugs ?? []).length > 3 && (
                        <span className="px-1 py-1 text-neutral-500">
                          и ещё {(p.topicSlugs ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-48">
                    <div className="text-sm">
                      {r ? (
                        <>
                          <span className="text-accent-500">★</span> {Number(r.avg).toFixed(1)}{" "}
                          <span className="text-neutral-400">({r.count})</span>
                        </>
                      ) : (
                        <Badge variant="secondary">Новый специалист</Badge>
                      )}
                    </div>
                    {near ? (
                      <div className="text-xs font-medium text-emerald-700">
                        Ближайшее время: {near.label}
                        <div className="font-normal text-neutral-500">
                          {near.count} свободных окон
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500">Свободных окон пока нет</div>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/p/${p.slug}`}>Смотреть профиль</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Вариант 2: компактный список с кнопками времени */}
        {v === "2" && (
          <div className="mt-6 divide-y divide-neutral-100">
            {list.map((p) => {
              const r = ratingOf(p.id);
              const day = nearestDay(p.id);
              return (
                <div key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <Photo p={p} className="h-16 w-16 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${p.slug}`} className="font-bold hover:text-brand-700">
                      {p.name}
                    </Link>{" "}
                    <span className="text-xs text-emerald-700">✓</span>
                    <div className="mt-0.5 text-sm text-neutral-600">
                      {[
                        p.approach,
                        p.experienceYears != null ? `${p.experienceYears} лет` : null,
                        gradePriceLabel(p.grade),
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      {r ? (
                        <>
                          · <span className="text-accent-500">★</span> {Number(r.avg).toFixed(1)} (
                          {r.count})
                        </>
                      ) : (
                        <>· новый специалист</>
                      )}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    {day ? (
                      <>
                        <div className="text-xs text-neutral-500">{day.dateLabel}</div>
                        <div className="mt-1 flex flex-wrap gap-2 sm:justify-end">
                          {day.times.map((t) => (
                            <Link
                              key={t}
                              href={`/p/${p.slug}`}
                              className="rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-600"
                            >
                              {t}
                            </Link>
                          ))}
                          {day.more > 0 && (
                            <Link
                              href={`/p/${p.slug}`}
                              className="rounded-lg bg-accent-500/10 px-3 py-1.5 text-sm font-semibold text-accent-600"
                            >
                              ещё {day.more}
                            </Link>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-500">Свободных окон пока нет</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Вариант 3: сетка 2 колонки, крупное фото */}
        {v === "3" && (
          <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2">
            {list.map((p) => {
              const r = ratingOf(p.id);
              const near = nearestLine(p.id);
              const say = firstSentence(p.about);
              return (
                <Link key={p.id} href={`/p/${p.slug}`} className="group min-w-0">
                  <Photo p={p} className="aspect-square w-full rounded-2xl" big />
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="font-bold group-hover:text-brand-700">{p.name}</span>
                    <span className="shrink-0 text-sm">
                      {r ? (
                        <>
                          <span className="text-accent-500">★</span> {Number(r.avg).toFixed(1)}
                        </>
                      ) : (
                        <span className="text-neutral-500">новый</span>
                      )}
                    </span>
                  </div>
                  {say && <p className="mt-1 truncate text-sm text-neutral-600">{say}</p>}
                  <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-sm text-neutral-500">
                    <span>
                      {[
                        p.approach,
                        p.experienceYears != null ? `${p.experienceYears} лет` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · <b className="text-neutral-900">{gradePriceLabel(p.grade)}</b>
                    </span>
                    {near && <span className="font-medium text-emerald-700">{near.label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
