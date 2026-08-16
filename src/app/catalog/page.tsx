import Link from "next/link";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, psychologists, reviews, slots, topics } from "@/db";
import { formatSlot, nowMsk } from "@/lib/datetime";
import { gradePriceLabel } from "@/lib/grades";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Психологи — mipsy" };
export const dynamic = "force-dynamic";

// Второй путь клиента (референс SmartMental): самостоятельный выбор.
// Фильтры простые и на ссылках — без сложного поиска, как договаривались.
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; gender?: string; age?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const all = await db
    .select()
    .from(psychologists)
    .where(and(eq(psychologists.moderationStatus, "approved"), eq(psychologists.hidden, false)));
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
  const thisYear = new Date().getFullYear();
  const list = all.filter((p) => {
    if (sp.topic && !(p.topicSlugs ?? []).includes(sp.topic)) return false;
    if (sp.gender && p.gender && p.gender !== sp.gender) return false;
    if (sp.age && p.birthYear) {
      const bracket = thisYear - p.birthYear < 40 ? "under40" : "over40";
      if (bracket !== sp.age) return false;
    }
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

  // Ближайшие свободные окна: сильнейший CTA карточки (ресёрч katalog-ux) и
  // порядок выдачи — специалисты с ближайшим временем выше.
  const free =
    all.length > 0
      ? await db
          .select({ psychologistId: slots.psychologistId, startsAt: slots.startsAt })
          .from(slots)
          .where(
            and(
              eq(slots.status, "free"),
              gte(slots.startsAt, nowMsk()),
              inArray(slots.psychologistId, all.map((p) => p.id)),
            ),
          )
          .orderBy(asc(slots.startsAt))
      : [];
  const nearest = (id: number) => {
    const s = free.filter((x) => x.psychologistId === id);
    return s.length === 0 ? null : { startsAt: s[0].startsAt, count: s.length };
  };
  const sorted = [...list].sort((a, b) => {
    const na = nearest(a.id)?.startsAt ?? "9999";
    const nb = nearest(b.id)?.startsAt ?? "9999";
    return na < nb ? -1 : na > nb ? 1 : 0;
  });

  // Первое предложение «О себе» — голос специалиста на карточке.
  const firstSentence = (text: string | null) => {
    if (!text) return null;
    const s = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
    return s.length > 10 ? (s.length > 160 ? `${s.slice(0, 157)}…` : s) : null;
  };

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
          Выбирайте и записывайтесь сразу — стоимость сессии видна в профиле специалиста. Если не
          хочется разбираться —{" "}
          <Link href="/login" className="font-medium text-brand-700 underline">
            начните подбор в личном кабинете
          </Link>
          , и мы подберём психолога за вас.
        </p>

        {/* Поиск и фильтры */}
        <form action="/catalog" className="mt-8 flex flex-wrap gap-2">
          {sp.topic && <input type="hidden" name="topic" value={sp.topic} />}
          {sp.gender && <input type="hidden" name="gender" value={sp.gender} />}
          {sp.age && <input type="hidden" name="age" value={sp.age} />}
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
            <span className="text-sm text-neutral-500">Специалист:</span>
            <FilterChip href={q({ gender: undefined })} active={!sp.gender}>
              не важно
            </FilterChip>
            <FilterChip href={q({ gender: "female" })} active={sp.gender === "female"}>
              женщина
            </FilterChip>
            <FilterChip href={q({ gender: "male" })} active={sp.gender === "male"}>
              мужчина
            </FilterChip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-500">Возраст:</span>
            <FilterChip href={q({ age: undefined })} active={!sp.age}>
              любой
            </FilterChip>
            <FilterChip href={q({ age: "under40" })} active={sp.age === "under40"}>
              до 40
            </FilterChip>
            <FilterChip href={q({ age: "over40" })} active={sp.age === "over40"}>
              40 и старше
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
              Начните подбор в кабинете — оператор подберёт психолога вручную, как только появится
              подходящий.
            </p>
            <Button asChild className="mt-5 rounded-lg bg-accent-500 hover:bg-accent-600">
              <Link href="/login">Начать подбор</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {sorted.map((p) => {
              const r = ratings.find((x) => x.psychologistId === p.id);
              const near = nearest(p.id);
              const say = firstSentence(p.about);
              const themes = p.topicSlugs ?? [];
              return (
                // Компоновка (референс Ясно): фото-портрет → досье → колонка
                // решения (цена, рейтинг, ближайшее окно, кнопка). Раскладка
                // полей одинаковая во всех карточках — так их сравнивают.
                <div
                  key={p.id}
                  className="flex flex-col gap-5 rounded-2xl border border-neutral-200 p-4 transition-colors hover:border-brand-400 sm:flex-row sm:p-5"
                >
                  <Link href={`/p/${p.slug}`} className="shrink-0">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        className="h-64 w-full rounded-xl object-cover sm:h-60 sm:w-52"
                      />
                    ) : (
                      <div className="flex h-64 w-full items-center justify-center rounded-xl bg-brand-100 text-7xl font-bold text-brand-700 sm:h-60 sm:w-52">
                        {p.name.slice(0, 1)}
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/p/${p.slug}`}
                        className="text-lg font-bold hover:text-brand-700"
                      >
                        {p.name}
                      </Link>
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                        title="Дипломы и опыт проверены при модерации"
                      >
                        ✓ Диплом проверен
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">
                      {[p.approach, p.experienceYears != null ? `опыт ${p.experienceYears} лет` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {say && (
                      <p className="mt-3 line-clamp-2 text-sm text-neutral-600 italic">«{say}»</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                      {themes.slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">
                          {topicTitle(s)}
                        </span>
                      ))}
                      {themes.length > 3 && (
                        <span className="text-neutral-500">и ещё {themes.length - 3}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2.5 border-neutral-100 sm:w-52 sm:border-l sm:pl-5">
                    <div className="text-sm font-semibold">
                      Сессия 50 минут
                      <div className="text-base">{gradePriceLabel(p.grade) ?? "цена уточняется"}</div>
                    </div>
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
                        Ближайшее время: {formatSlot(near.startsAt)}
                        <div className="mt-0.5 font-normal text-neutral-500">
                          {near.count} свободных окон
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-500">Свободных окон пока нет</div>
                    )}
                    <Button asChild size="sm" className="mt-auto sm:w-full">
                      <Link href={`/p/${p.slug}`}>Выбрать время</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
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
