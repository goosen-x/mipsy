import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, reviews, slots, topics } from "@/db";
import { Badge } from "@/components/ui/badge";
import { CabinetHeader } from "@/components/site";
import { canClientChange, formatSlot, isPast, TZ_LABEL } from "@/lib/datetime";
import { currentAccount } from "@/lib/auth";
import { gradePriceLabel } from "@/lib/grades";
import { label, REQUEST_STATUS_LABELS } from "@/lib/labels";
import { enabledProviders } from "@/lib/payments";
import { PayButtons } from "./pay";
import {
  BookingActions,
  BookingSection,
  ChoosePsychologist,
  RematchControl,
  ReviewForm,
  SupportForm,
} from "./controls";

export const metadata = { title: "Личный кабинет — mipsy" };
export const dynamic = "force-dynamic";

export default async function ClientCabinetPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fme");

  const myRequests = await db
    .select()
    .from(clientRequests)
    .where(eq(clientRequests.accountId, account.id))
    .orderBy(desc(clientRequests.id));
  const req = myRequests[0];

  // Аккаунт специалиста в клиентский кабинет не ходит. Исключение — заявки,
  // оставшиеся от времён, когда обе роли жили на одной почте: их не прячем,
  // иначе человек потеряет свои брони. Разносит такие пары админ.
  if (account.role === "psychologist" && !req) {
    return (
      <div className="min-h-screen bg-white">
        <CabinetHeader title={account.name} />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <section>
            <h1 className="text-2xl font-bold">Эта почта — кабинет специалиста</h1>
            <p className="mt-3 text-neutral-600">
              На {account.email} заведён кабинет психолога, а кабинет клиента живёт отдельно:
              так профиль, заявки и брони не перемешиваются. Если вы хотите обратиться к
              психологу для себя — войдите с другого адреса, это будет отдельный кабинет.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/cab"
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
              >
                Мой кабинет специалиста
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
              >
                Войти с другой почты
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="min-h-screen bg-white">
        <CabinetHeader title={account.name} />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <section>
            <h1 className="text-2xl font-bold">Здравствуйте, {account.name}!</h1>
            <p className="mt-3 text-neutral-600">
              Ваш кабинет готов. Ответьте на несколько вопросов — мы изучим их и предложим
              специалистов под ваш запрос. А можно выбрать психолога самостоятельно в каталоге.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/anketa"
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
              >
                Подобрать психолога
              </Link>
              <Link
                href="/catalog"
                className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
              >
                Открыть каталог
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const requestIds = myRequests.map((r) => r.id);

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
    .select({
      id: slots.id,
      startsAt: slots.startsAt,
      durationMin: slots.durationMin,
      status: slots.status,
      meetingLink: slots.meetingLink,
      paidAt: slots.paidAt,
      psychologistId: slots.psychologistId,
      psyName: psychologists.name,
      psyGrade: psychologists.grade,
    })
    .from(slots)
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .where(inArray(slots.clientRequestId, requestIds))
    .orderBy(asc(slots.startsAt));
  const upcoming = mySlots.filter((s) => s.status === "booked" && !isPast(s.startsAt, now));
  // Кнопки оплаты видны, только когда настроен хотя бы один платёжный провайдер.
  const payProviders = enabledProviders();
  // Прошедшее целиком: состоявшиеся, неявки и брони, где специалист ещё не
  // отметил итог, — свежие сверху.
  const past = mySlots
    .filter(
      (s) =>
        s.status === "done" ||
        s.status === "no_show" ||
        (s.status === "booked" && isPast(s.startsAt, now)),
    )
    .reverse();
  const held = past.filter((s) => s.status === "done");

  const myReviews = held.length
    ? await db
        .select({ slotId: reviews.slotId, rating: reviews.rating, status: reviews.status })
        .from(reviews)
        .where(
          inArray(
            reviews.slotId,
            held.map((s) => s.id),
          ),
        )
    : [];

  // Свободные окна нужны для двух вещей: запись к выбранному специалисту и
  // перенос существующих броней. Бронь могла быть у другого психолога (запись
  // из каталога, прошлый подбор) — перенос предлагает окна именно её специалиста.
  const slotPsyIds = [
    ...new Set([...(chosen ? [chosen.psy.id] : []), ...upcoming.map((s) => s.psychologistId)]),
  ];
  const freeSlots = slotPsyIds.length
    ? (
        await db
          .select()
          .from(slots)
          .where(and(inArray(slots.psychologistId, slotPsyIds), eq(slots.status, "free")))
          .orderBy(asc(slots.startsAt))
      ).filter((s) => !isPast(s.startsAt, now))
    : [];
  const toCalendar = (list: typeof freeSlots) =>
    list.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      isIntroCall: s.isIntroCall,
    }));
  const calendarSlots = chosen
    ? toCalendar(freeSlots.filter((s) => s.psychologistId === chosen.psy.id))
    : [];
  const freeSlotsByPsy = (psyId: number) =>
    toCalendar(freeSlots.filter((s) => s.psychologistId === psyId));

  return (
    <div className="min-h-screen bg-white">
      <CabinetHeader title={req.name} />

      <main className="mx-auto max-w-3xl space-y-12 px-4 py-10">
        {account.role === "psychologist" && (
          // Наследие: до разделения ролей обе жили на одной почте. Заявки не
          // прячем, но предупреждаем — новые заводятся только с другого адреса.
          <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
            На этой почте кабинет специалиста, а эти заявки остались от времени, когда роли
            жили на одном адресе. Они продолжают работать, но новую анкету отсюда не подать —
            для обращений как клиент заведите отдельный вход с другой почты. Если нужно
            разнести — напишите в <Link href="/support" className="underline">поддержку</Link>.
          </div>
        )}
        <section>
          <h1 className="text-2xl font-bold">Здравствуйте, {req.name}!</h1>
          {req.status === "new" && (
            <p className="mt-3 text-neutral-600">
              Ваша анкета у оператора. Мы напишем на {req.email ?? account.email} в течение
              рабочего дня, чтобы уточнить детали и подобрать специалистов.
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
            <>
              <p className="mt-3 text-neutral-600">
                По вашей заявке мы больше не ведём подбор. Если запрос снова актуален — начните
                новый подбор, прежние ответы не пропадут.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/anketa"
                  className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
                >
                  Подобрать психолога
                </Link>
                <Link
                  href="/catalog"
                  className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
                >
                  Открыть каталог
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Выбор из предложенных специалистов */}
        {proposals.length > 0 && !chosen && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">
              Мы подобрали для вас{" "}
              {proposals.length === 1 ? "специалиста" : `${proposals.length} специалистов`}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Посмотрите профили и выберите того, кто откликнется. Если не подойдёт — бесплатно
              подберём другого.
            </p>
            <div className="mt-4 divide-y divide-neutral-100">
              {proposals.map((p) => (
                <div key={p.matchId} className="py-5">
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
                        <ChoosePsychologist psychologistId={p.psy.id} />
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
          <section className="border-t border-neutral-100 pt-8">
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
                  {gradePriceLabel(chosen.psy.grade) ?? "стоимость уточняется"}
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
                Вы выбрали из {proposals.length} предложенных. Передумали? Попросите другого
                специалиста в разделе «Психолог не подошёл?» внизу страницы.
              </p>
            )}
          </section>
        )}

        {/* Встречи */}
        {upcoming.length > 0 && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">Предстоящие встречи</h2>
            <p className="mt-1 text-xs text-neutral-500">Время указано {TZ_LABEL}</p>
            <ul className="mt-2 divide-y divide-neutral-100">
              {upcoming.map((s) => (
                <li key={s.id} className="py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {formatSlot(s.startsAt)}
                        {s.paidAt ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                            оплачена
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                            не оплачена
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-neutral-500">
                        с {s.psyName} · {s.durationMin} минут
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm">
                        <Link href={`/api/ics?slot=${s.id}`} className="text-brand-700 underline">
                          Добавить в календарь
                        </Link>
                        {s.meetingLink && (
                          <a
                            href={s.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-accent-600 underline"
                          >
                            Ссылка на встречу
                          </a>
                        )}
                      </div>
                    </div>
                    <BookingActions
                      slotId={s.id}
                      startsAt={s.startsAt}
                      canChange={canClientChange(s.startsAt, now)}
                      freeSlots={freeSlotsByPsy(s.psychologistId)}
                    />
                  </div>
                  {!s.paidAt && gradePriceLabel(s.psyGrade) && (
                    <PayButtons
                      slotId={s.id}
                      priceLabel={gradePriceLabel(s.psyGrade)!}
                      providers={payProviders}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Прошедшие встречи: состоявшиеся (с отзывом), неявки и ждущие отметки */}
        {past.length > 0 && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">Прошедшие встречи</h2>
            <ul className="mt-2 divide-y divide-neutral-100">
              {past.map((s) => {
                const review = myReviews.find((r) => r.slotId === s.id);
                return (
                  <li key={s.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{formatSlot(s.startsAt)}</div>
                      <span className="text-sm text-neutral-500">
                        с {s.psyName} ·{" "}
                        {s.status === "done"
                          ? "состоялась"
                          : s.status === "no_show"
                            ? "не состоялась — вы не пришли"
                            : "прошла, специалист ещё не подтвердил итог"}
                      </span>
                    </div>
                    {s.status === "done" &&
                      (review ? (
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
                            <ReviewForm slotId={s.id} />
                          </div>
                        </div>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Запись */}
        {chosen && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">Выберите время встречи</h2>
            {calendarSlots.length === 0 ? (
              <p className="mt-3 text-neutral-500">
                Свободного времени пока нет — специалист скоро откроет расписание. Оператор поможет
                договориться, если нужно срочно.
              </p>
            ) : (
              <div className="mt-4">
                <BookingSection slots={calendarSlots} />
              </div>
            )}
          </section>
        )}

        {/* Оплата */}
        {chosen && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">Оплата</h2>
            <p className="mt-2 text-neutral-600">
              Сессии
              {gradePriceLabel(chosen.psy.grade) ? ` стоят ${gradePriceLabel(chosen.psy.grade)} и` : ""}{" "}
              оплачиваются напрямую специалисту, как вы договоритесь.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Онлайн-оплата на платформе появится позже.
            </p>
          </section>
        )}

        {/* Переподбор */}
        {chosen && req.status !== "rematch" && (
          <section id="rematch" className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">Психолог не подошёл?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Это нормально и случается часто — совпасть с первого раза удаётся не всем. Мы
              бесплатно подберём другого специалиста.
            </p>
            <div className="mt-4">
              <RematchControl />
            </div>
          </section>
        )}

        {/* Прошлые обращения */}
        {myRequests.length > 1 && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-lg font-bold">Прошлые обращения</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              {myRequests.slice(1).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span>{r.createdAt.slice(0, 10)}</span>
                  <Badge variant="secondary">{label(REQUEST_STATUS_LABELS, r.status)}</Badge>
                  {r.mainProblem && <span className="text-neutral-500">{r.mainProblem}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-400">
              Встречи по прошлым обращениям видны выше вместе с остальными.
            </p>
          </section>
        )}

        {/* Поддержка */}
        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-lg font-bold">Поддержка</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Есть вопрос или что-то пошло не так? Напишите нам — оператор ответит на{" "}
            {req.email ?? account.email}.
          </p>
          <div className="mt-4">
            <SupportForm />
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
          Вход в кабинет — по адресу {account.email} и коду из письма. Статус обращения:{" "}
          <Badge variant="secondary">{label(REQUEST_STATUS_LABELS, req.status)}</Badge>
        </p>
      </main>
    </div>
  );
}
