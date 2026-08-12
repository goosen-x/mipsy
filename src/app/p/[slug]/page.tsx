import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, psychologists, topics } from "@/db";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Публичный профиль: 7 фиксированных секций, никаких контактов.
export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [psy] = await db
    .select()
    .from(psychologists)
    .where(and(eq(psychologists.slug, slug), eq(psychologists.moderationStatus, "approved")));
  if (!psy) notFound();

  const topicTitles =
    psy.topicSlugs && psy.topicSlugs.length > 0
      ? await db
          .select()
          .from(topics)
          .where(inArray(topics.slug, psy.topicSlugs))
          .orderBy(asc(topics.sort))
      : [];

  const formatLabel =
    psy.format === "online" ? "Онлайн" : psy.format === "offline" ? "Очно" : "Онлайн и очно";

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
              {psy.format && (
                <>
                  <dt className="text-neutral-500">Формат</dt>
                  <dd>{formatLabel}</dd>
                </>
              )}
              <dt className="text-neutral-500">Стоимость</dt>
              <dd>{psy.price || "уточняется при подборе"}</dd>
            </dl>
            {psy.introCallEnabled && (
              <Badge className="mt-3" variant="secondary">
                Бесплатное знакомство · 20 минут
              </Badge>
            )}
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

        {/* 7. Единственная кнопка «Записаться» — через анкету, контакты закрыты */}
        <section className="mt-12 rounded-3xl bg-brand-50 p-8 text-center">
          <h2 className="text-2xl font-bold">Хотите работать с этим специалистом?</h2>
          <p className="mx-auto mt-2 max-w-md text-neutral-600">
            Заполните анкету и скажите оператору, что вам откликнулся профиль {psy.name} — мы
            согласуем время встречи.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-lg bg-accent-500 px-8 hover:bg-accent-600"
          >
            <Link href="/anketa">Записаться</Link>
          </Button>
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
