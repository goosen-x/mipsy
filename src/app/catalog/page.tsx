import Link from "next/link";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, psychologists, reviews, topics } from "@/db";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Психологи — mipsy" };
export const dynamic = "force-dynamic";

// Второй путь клиента (референс SmartMental): самостоятельный выбор.
// Фильтры простые и на ссылках — без сложного поиска, как договаривались.
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; gender?: string; format?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const all = await db
    .select()
    .from(psychologists)
    .where(eq(psychologists.moderationStatus, "approved"));
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const ratings =
    all.length > 0
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
              inArray(reviews.psychologistId, all.map((p) => p.id)),
            ),
          )
          .groupBy(reviews.psychologistId)
      : [];

  // Поиск фильтруем в приложении: SQLite LIKE не умеет регистр кириллицы,
  // а специалистов на платформе десятки, а не тысячи.
  const query = (sp.q ?? "").trim().toLowerCase();
  const list = all.filter((p) => {
    if (sp.topic && !(p.topicSlugs ?? []).includes(sp.topic)) return false;
    if (sp.format && p.format !== sp.format && p.format !== "both") return false;
    if (query) {
      const topicTitles = (p.topicSlugs ?? [])
        .map((slug) => topicList.find((t) => t.slug === slug)?.title ?? "")
        .join(" ");
      const haystack = [p.name, p.approach, p.about, p.howSessions, p.education, topicTitles]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const topicTitle = (slug: string) => topicList.find((t) => t.slug === slug)?.title ?? slug;
  const q = (patch: Record<string, string | undefined>) => {
    const merged = { ...sp, ...patch };
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) usp.set(k, v);
    const s = usp.toString();
    return s ? `/catalog?${s}` : "/catalog";
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">Наши психологи</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Первая встреча с любым специалистом бесплатная — выбирайте и записывайтесь сразу. Если не
          хочется разбираться —{" "}
          <Link href="/anketa" className="font-medium text-brand-700 underline">
            заполните анкету
          </Link>
          , и мы подберём психолога за вас.
        </p>

        {/* Поиск и фильтры */}
        <form action="/catalog" className="mt-8 flex flex-wrap gap-2">
          {sp.topic && <input type="hidden" name="topic" value={sp.topic} />}
          {sp.format && <input type="hidden" name="format" value={sp.format} />}
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Имя, подход или тема — например «тревога» или «гештальт»"
            className="h-11 flex-1 rounded-lg border border-neutral-300 px-4 text-base outline-none focus:border-brand-400"
          />
          <Button type="submit" className="h-11 rounded-lg">
            Найти
          </Button>
          {sp.q && (
            <Button asChild variant="ghost" className="h-11">
              <Link href={q({ q: undefined })}>Сбросить</Link>
            </Button>
          )}
        </form>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-500">Тема:</span>
            <FilterChip href={q({ topic: undefined })} active={!sp.topic}>
              любая
            </FilterChip>
            {topicList.map((t) => (
              <FilterChip key={t.slug} href={q({ topic: t.slug })} active={sp.topic === t.slug}>
                {t.title}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-500">Формат:</span>
            <FilterChip href={q({ format: undefined })} active={!sp.format}>
              любой
            </FilterChip>
            <FilterChip href={q({ format: "online" })} active={sp.format === "online"}>
              онлайн
            </FilterChip>
            <FilterChip href={q({ format: "offline" })} active={sp.format === "offline"}>
              очно
            </FilterChip>
          </div>
        </div>

        {/* Список */}
        {list.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-brand-50 p-8 text-center">
            <p className="text-lg font-medium">
              {all.length === 0
                ? "Мы как раз набираем первую команду специалистов"
                : query
                  ? `По запросу «${sp.q}» никого не нашлось`
                  : "По этим условиям пока никого нет"}
            </p>
            <p className="mt-2 text-neutral-600">
              Оставьте заявку — оператор подберёт психолога вручную, как только появится подходящий.
            </p>
            <Button asChild className="mt-5 rounded-lg bg-accent-500 hover:bg-accent-600">
              <Link href="/anketa">Заполнить анкету</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Link key={p.id} href={`/p/${p.slug}`}>
                <Card className="h-full transition-colors hover:border-brand-400">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoUrl}
                          alt={p.name}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-700">
                          {p.name.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-neutral-500">{p.approach}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-neutral-600">
                      {p.experienceYears != null && <>Опыт {p.experienceYears} лет · </>}
                      {p.price || "цена уточняется"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(p.topicSlugs ?? []).slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800"
                        >
                          {topicTitle(s)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {(() => {
                        const r = ratings.find((x) => x.psychologistId === p.id);
                        return r ? (
                          <span className="text-sm">
                            <span className="text-accent-500">★</span> {Number(r.avg).toFixed(1)}{" "}
                            <span className="text-neutral-400">({r.count})</span>
                          </span>
                        ) : (
                          <Badge variant="secondary">Первая встреча бесплатно</Badge>
                        );
                      })()}
                      <span className="text-sm font-medium text-accent-600">
                        Выбрать время →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-brand-600 px-3 py-1.5 text-sm text-white"
          : "rounded-full border border-neutral-300 px-3 py-1.5 text-sm hover:border-brand-400"
      }
    >
      {children}
    </Link>
  );
}
