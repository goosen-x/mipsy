import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, reviews, slots, topics } from "@/db";
import { Badge } from "@/components/ui/badge";
import { canClientChange, formatSlot, isPast, TZ_LABEL } from "@/lib/datetime";
import {
  BookingActions,
  BookingSection,
  ChoosePsychologist,
  RematchControl,
  ReviewForm,
  SupportForm,
} from "./controls";

export const metadata = { title: "Моя страница — mipsy" };
export const dynamic = "force-dynamic";

export default async function ClientCabinetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [req] = await db.select().from(clientRequests).where(eq(clientRequests.clientToken, token));
  if (!req) notFound();

  const proposals = await db
    .select({ matchId: matches.id, chosen: matches.chosen, note: matches.note, psy: psychologists })
    .from(matches)
    .innerJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(and(eq(matches.clientRequestId, req.id), eq(matches.active, true)));
  const chosen = proposals.find((p) => p.chosen);

  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const topicTitle = (slug: string) => topicList.find((t) => t.slug === slug)?.title ?? slug;

  const now = new Date();
  const mySlots = await db
    .select()
    .from(slots)
    .where(eq(slots.clientRequestId, req.id))
    .orderBy(asc(slots.startsAt));
  const upcoming = mySlots.filter((s) => s.status === "booked" && !isPast(s.startsAt, now));
  const held = mySlots.filter((s) => s.status === "done");

  const myReviews = held.length
    ? await db
        .select({ slotId: reviews.slotId, rating: reviews.rating, status: reviews.status })
        .from(reviews)
        .where(inArray(reviews.slotId, held.map((s) => s.id)))
    : [];

  const freeSlots = chosen
    ? (
        await db
          .select()
          .from(slots)
          .where(and(eq(slots.psychologistId, chosen.psy.id), eq(slots.status, "free")))
          .orderBy(asc(slots.startsAt))
      ).filter((s) => !isPast(s.startsAt, now))
    : [];
  const calendarSlots = freeSlots.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    durationMin: s.durationMin,
    isIntroCall: s.isIntroCall,
  }));

  return (
    <div className="min-h-screen bg-brand-50/40">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            mipsy
          </Link>
          <span className="text-sm text-neutral-500">{req.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Здравствуйте, {req.name}!</h1>
          {req.status === "new" && (
            <p className="mt-3 text-neutral-600">
              Ваша анкета у оператора. Мы позвоним на {req.phone} в течение рабочего дня, чтобы
              уточнить детали и подобрать специалистов.
            </p>
          )}
          {req.status === "called" && (
            <p className="mt-3 text-neutral-600">
              Мы уже пообщались и подбираем для вас психологов. Как только они появятся здесь —
              можно будет выбрать специалиста и время встречи.
            </p>
          )}
          {req.status === "rematch" && (
            <p className="mt-3 text-neutral-600">
              Мы получили ваш запрос на другого специалиста и подбираем нового. Прежние записи
              отменены.
            </p>
          )}
          {req.status === "rejected" && (
            <p className="mt-3 text-neutral-600">
              По вашей заявке мы больше не ведём подбор. Если это ошибка — заполните анкету заново.
            </p>
          )}
        </section>

        {/* Выбор из предложенных специалистов */}
        {proposals.length > 0 && !chosen && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">
              Мы подобрали для вас {proposals.length === 1 ? "специалиста" : `${proposals.length} специалистов`}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Посмотрите профили и выберите того, кто откликнется. Первая встреча бесплатная, а если
              не подойдёт — подберём другого.
            </p>
            <div className="mt-5 space-y-4">
              {proposals.map((p) => (
                <div key={p.matchId} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {p.psy.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.psy.photoUrl}
                        alt={p.psy.name}
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brand-100 text-2xl font-bold text-brand-700">
                        {p.psy.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-lg font-semibold">{p.psy.name}</div>
                      <div className="text-sm text-neutral-500">
                        {p.psy.approach}
                        {p.psy.experienceYears != null && ` · опыт ${p.psy.experienceYears} лет`}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(p.psy.topicSlugs ?? []).slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800"
                          >
                            {topicTitle(s)}
                          </span>
                        ))}
                      </div>
                      {p.note && p.note !== "выбрал сам в каталоге" && (
                        <p className="mt-2 text-sm text-neutral-600">Почему подошёл: {p.note}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <ChoosePsychologist token={token} psychologistId={p.psy.id} />
                        {p.psy.slug && (
                          <Link
                            href={`/p/${p.psy.slug}`}
                            className="text-sm text-brand-700 underline"
                            target="_blank"
                          >
                            Открыть профиль
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Выбранный психолог */}
        {chosen && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Ваш психолог</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {chosen.psy.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chosen.psy.photoUrl}
                  alt={chosen.psy.name}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700">
                  {chosen.psy.name.slice(0, 1)}
                </div>
              )}
              <div className="flex-1">
                <div className="text-xl font-semibold">{chosen.psy.name}</div>
                <div className="text-neutral-500">{chosen.psy.approach}</div>
                <div className="mt-1 text-sm text-neutral-600">
                  {chosen.psy.price || "стоимость уточняется"} · первая встреча бесплатно
                </div>
                {chosen.psy.slug && (
                  <Link
                    href={`/p/${chosen.psy.slug}`}
                    className="mt-1 inline-block text-sm text-brand-700 underline"
                  >
                    Открыть профиль
                  </Link>
                )}
              </div>
            </div>
            {proposals.length > 1 && (
              <p className="mt-3 text-xs text-neutral-500">
                Вы выбрали из {proposals.length} предложенных. Пока не записались — можно выбрать
                другого специалиста ниже.
              </p>
            )}
          </section>
        )}

        {/* Встречи */}
        {upcoming.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Ваши встречи</h2>
            <p className="mt-1 text-xs text-neutral-500">Время указано {TZ_LABEL}</p>
            <ul className="mt-4 space-y-3">
              {upcoming.map((s) => (
                <li key={s.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{formatSlot(s.startsAt)}</div>
                      <div className="text-sm text-neutral-500">
                        {s.durationMin} минут
                        {s.isIntroCall && " · первая встреча, бесплатно"}
                      </div>
                      <Link
                        href={`/api/ics?token=${token}&slot=${s.id}`}
                        className="mt-1 inline-block text-sm text-brand-700 underline"
                      >
                        Добавить в календарь
                      </Link>
                    </div>
                    <BookingActions
                      token={token}
                      slotId={s.id}
                      startsAt={s.startsAt}
                      canChange={canClientChange(s.startsAt, now)}
                      freeSlots={calendarSlots}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Отзывы о состоявшихся встречах */}
        {held.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Прошедшие встречи</h2>
            <ul className="mt-4 space-y-4">
              {held.map((s) => {
                const review = myReviews.find((r) => r.slotId === s.id);
                return (
                  <li key={s.id} className="rounded-xl border p-4">
                    <div className="font-medium">{formatSlot(s.startsAt)}</div>
                    {review ? (
                      <p className="mt-2 text-sm text-neutral-600">
                        Ваша оценка: {"★".repeat(review.rating)}
                        {review.status === "pending" && " · отзыв на модерации"}
                        {review.status === "published" && " · опубликован"}
                      </p>
                    ) : (
                      <div className="mt-3">
                        <p className="text-sm text-neutral-600">
                          Как всё прошло? Оценка помогает другим людям выбрать специалиста.
                        </p>
                        <div className="mt-3">
                          <ReviewForm token={token} slotId={s.id} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Запись */}
        {chosen && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Выберите время встречи</h2>
            {calendarSlots.length === 0 ? (
              <p className="mt-3 text-neutral-500">
                Свободного времени пока нет — специалист скоро откроет расписание. Оператор поможет
                договориться, если нужно срочно.
              </p>
            ) : (
              <div className="mt-4">
                <BookingSection token={token} slots={calendarSlots} />
              </div>
            )}
          </section>
        )}

        {/* Оплата */}
        {chosen && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Оплата</h2>
            <p className="mt-2 text-neutral-600">
              Первая встреча бесплатная — платить за неё не нужно. Последующие сессии
              {chosen.psy.price ? ` стоят ${chosen.psy.price} и ` : " "}
              оплачиваются напрямую специалисту, как вы договоритесь.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Онлайн-оплата на платформе появится позже.
            </p>
          </section>
        )}

        {/* Переподбор */}
        {chosen && req.status !== "rematch" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Психолог не подошёл?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Это нормально и случается часто — совпасть с первого раза удаётся не всем. Мы
              бесплатно подберём другого специалиста.
            </p>
            <div className="mt-4">
              <RematchControl token={token} />
            </div>
          </section>
        )}

        {/* Поддержка */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Поддержка</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Есть вопрос или что-то пошло не так? Напишите нам — оператор ответит по телефону{" "}
            {req.phone}.
          </p>
          <div className="mt-4">
            <SupportForm token={token} />
          </div>
        </section>

        {req.crisisFlag && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-900">
              Если станет совсем тяжело — не ждите звонка оператора:{" "}
              <Link href="/crisis" className="font-medium underline">
                телефоны круглосуточной поддержки
              </Link>
              .
            </p>
          </section>
        )}

        <p className="pb-4 text-center text-xs text-neutral-400">
          Эта страница личная — не пересылайте ссылку. Статус:{" "}
          <Badge variant="secondary">{req.status}</Badge>
        </p>
      </main>
    </div>
  );
}
