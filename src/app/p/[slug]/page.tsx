import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, psychologists, reviews, slots, topics } from "@/db";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Badge } from "@/components/ui/badge";
import { currentAccount } from "@/lib/auth";
import { isPast } from "@/lib/datetime";
import { gradePriceLabel } from "@/lib/grades";
import { ProfileBooking } from "./booking";

export const dynamic = "force-dynamic";

// Публичный профиль: 7 фиксированных секций, никаких контактов.
export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Профиль публичный, но запись — только после входа.
  const account = await currentAccount();
  const [psy] = await db
    .select()
    .from(psychologists)
    .where(
      and(
        eq(psychologists.slug, slug),
        eq(psychologists.moderationStatus, "approved"),
        eq(psychologists.hidden, false),
      ),
    );
  if (!psy) notFound();

  const topicTitles =
    psy.topicSlugs && psy.topicSlugs.length > 0
      ? await db
          .select()
          .from(topics)
          .where(inArray(topics.slug, psy.topicSlugs))
          .orderBy(asc(topics.sort))
      : [];

  const published = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      authorName: reviews.authorName,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.psychologistId, psy.id), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt));
  // Средняя — по всем опубликованным, как в каталоге: одна и та же цифра на
  // соседних экранах. Показываем только последние десять текстов.
  const avg =
    published.length > 0
      ? (published.reduce((sum, r) => sum + r.rating, 0) / published.length).toFixed(1)
      : null;
  const recentReviews = published.slice(0, 10);

  const now = new Date();
  const freeSlots = (
    await db
      .select()
      .from(slots)
      .where(and(eq(slots.psychologistId, psy.id), eq(slots.status, "free")))
      .orderBy(asc(slots.startsAt))
  ).filter((s) => !isPast(s.startsAt, now));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* 1. Шапка */}
        <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {psy.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={psy.photoUrl}
              alt={psy.name}
              className="h-36 w-36 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-2xl bg-brand-100 text-4xl font-bold text-brand-700">
              {psy.name.slice(0, 1)}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{psy.name}</h1>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {psy.approach && (
                <>
                  <dt className="text-neutral-500">Подход</dt>
                  <dd>{psy.approach}</dd>
                </>
              )}
              {psy.experienceYears != null && (
                <>
                  <dt className="text-neutral-500">Опыт</dt>
                  <dd>{psy.experienceYears} лет</dd>
                </>
              )}
              <dt className="text-neutral-500">Формат</dt>
              <dd>Онлайн, по видеосвязи</dd>
              <dt className="text-neutral-500">Стоимость</dt>
              <dd>{gradePriceLabel(psy.grade) ?? "уточняется при подборе"}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {avg && (
                <span className="text-sm">
                  <span className="text-accent-500">★</span> {avg}{" "}
                  <span className="text-neutral-500">· {published.length} отзыв(ов)</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 2. О себе */}
        {psy.about && (
          <Section title="О себе">
            {psy.about.split(/\n+/).map((p, i) => (
              <p key={i} className="mt-3 text-neutral-700 first:mt-0">
                {p}
              </p>
            ))}
          </Section>
        )}

        {/* 3. Темы */}
        {topicTitles.length > 0 && (
          <Section title="С чем я работаю">
            <div className="flex flex-wrap gap-2">
              {topicTitles.map((t) => (
                <span
                  key={t.slug}
                  className="rounded-full bg-brand-50 px-4 py-2 text-sm text-brand-800"
                >
                  {t.title}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* 4. Как проходят встречи */}
        {psy.howSessions && (
          <Section title="Как проходят встречи">
            <p className="text-neutral-700">{psy.howSessions}</p>
          </Section>
        )}

        {/* 5. Образование — проверено при модерации */}
        {psy.education && (
          <Section title="Образование">
            <p className="whitespace-pre-line text-neutral-700">{psy.education}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm text-brand-800">
              ✓ Проверено при модерации mipsy
            </p>
          </Section>
        )}

        {/* 6. Мини-FAQ */}
        {psy.faq && psy.faq.length > 0 && (
          <Section title="Частые вопросы">
            <div className="space-y-4">
              {psy.faq.map((f) => (
                <div key={f.q}>
                  <div className="font-semibold">{f.q}</div>
                  <p className="mt-1 text-neutral-600">{f.a}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Отзывы клиентов */}
        {published.length > 0 && (
          <Section title="Отзывы">
            <ul className="space-y-4">
              {recentReviews.map((r) => (
                <li key={r.id} className="rounded-2xl border p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-accent-500">{"★".repeat(r.rating)}</span>
                    <span className="font-medium">{r.authorName}</span>
                    <span className="text-neutral-400">{r.createdAt.slice(0, 10)}</span>
                  </div>
                  {r.body && <p className="mt-2 text-neutral-700">{r.body}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-400">
              Отзывы оставляют только клиенты, у которых встреча состоялась. Каждый проходит проверку
              оператором.
            </p>
          </Section>
        )}

        {/* 7. Запись: выбор времени прямо здесь */}
        <section id="booking" className="mt-12 rounded-3xl bg-brand-50 p-6 sm:p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Запись на встречу</h2>
            <p className="mx-auto mt-2 max-w-lg text-neutral-600">
              Выберите удобную дату и время
              {gradePriceLabel(psy.grade) ? ` — сессия ${gradePriceLabel(psy.grade)}` : ""}. Оплата
              напрямую специалисту.
            </p>
          </div>
          <div className="mt-6">
            <ProfileBooking
              slug={slug}
              psyName={psy.name}
              viewer={account ? { name: account.name, email: account.email } : null}
              slots={freeSlots.map((s) => ({
                id: s.id,
                startsAt: s.startsAt,
                durationMin: s.durationMin,
                isIntroCall: s.isIntroCall,
              }))}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
