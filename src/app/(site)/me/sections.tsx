import Link from "next/link";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconCreditCard,
  IconHeadset,
  IconSearch,
  IconUserHeart,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSlot, TZ_LABEL } from "@/lib/datetime";
import { gradePriceLabel } from "@/lib/grades";
import { cn } from "@/lib/utils";
import { label, REQUEST_STATUS_LABELS } from "@/lib/labels";
import { BookingActions, BookingSection, RematchControl, ReviewForm, SupportForm } from "./controls";
import type { Cabinet } from "./data";
import { PayButtons } from "./pay";
import { ProposalsView } from "./proposals-variants";
import { SectionTitle, waitingText } from "./shell";

/*
 * Содержимое разделов кабинета клиента. Одно и то же содержимое показывают
 * все варианты кабинета: отдельными страницами (вкладки, боковое меню,
 * плитки, приложение) или подряд на одной странице.
 */

export function HomeBody({ c }: { c: Cabinet }) {
  const { account, req, chosen } = c;
  const step = nextStep(c);
  const next = c.upcoming[0];
  const unpaid = c.upcoming.filter((s) => !s.paidAt).length;
  return (
    <>
      {account.role === "psychologist" && (
        // Наследие: до разделения ролей обе жили на одной почте. Заявки не
        // прячем, но предупреждаем — новые заводятся только с другого адреса.
        <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
          На этой почте кабинет специалиста, а эти заявки остались от времени, когда роли
          жили на одном адресе. Они продолжают работать, но новую анкету отсюда не подать —
          для обращений как клиент заведите отдельный вход с другой почты. Если нужно
          разнести — напишите в <Link href="/me/podderzhka" className="underline">поддержку</Link>.
        </div>
      )}

      <section className="space-y-6">
        <h1 className="text-3xl font-bold">Здравствуйте, {req.name}!</h1>
        <NextStepCard step={step} c={c} />
      </section>

      <section className="divide-y divide-neutral-100 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
        <SummaryRow
          href="/me/podbor"
          title="Психолог"
          value={chosen ? chosen.psy.name : c.showProposals ? "Выберите из подборки" : "Подбираем"}
          media={
            chosen ? (
              <PsyThumb name={chosen.psy.name} photoUrl={chosen.psy.photoUrl} />
            ) : (
              <RowIcon icon={IconUserHeart} />
            )
          }
        />
        <SummaryRow
          href="/me/vstrechi"
          title="Ближайшая встреча"
          value={next ? formatSlot(next.startsAt) : "Пока не запланирована"}
          media={<RowIcon icon={IconCalendarEvent} />}
        />
        <SummaryRow
          href="/me/oplaty"
          title="Оплата"
          value={unpaid ? `Ждут оплаты: ${unpaid}` : "Всё оплачено"}
          media={<RowIcon icon={IconCreditCard} tone={unpaid ? "warn" : "brand"} />}
          warn={unpaid > 0}
        />
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
    </>
  );
}

/** Карточка главного шага: шкала пути клиента и одно действие. */
export function NextStepCard({ step, c, tone = "soft" }: { step: Step; c: Cabinet; tone?: "soft" | "solid" }) {
  const solid = tone === "solid";
  return (
    <div className={solid ? "flex h-full flex-col rounded-3xl bg-brand-600 p-6 text-white sm:p-8" : "rounded-3xl bg-brand-50 p-6 sm:p-8"}>
      <Journey c={c} solid={solid} />
      <div className={solid ? "mt-8 text-sm font-medium uppercase tracking-wide text-white/70" : "mt-8 text-sm font-medium uppercase tracking-wide text-brand-700"}>
        Что дальше
      </div>
      <h2 className="mt-2 text-2xl font-bold">{step.title}</h2>
      <p className={solid ? "mt-2 max-w-xl text-white/85" : "mt-2 max-w-xl text-neutral-700"}>{step.text}</p>
      {step.href && (
        <div className={solid ? "mt-auto pt-6" : "mt-6"}>
          <Button asChild size="lg" variant={solid ? "secondary" : "default"} className="rounded-xl">
            {step.external ? (
              <a href={step.href} target="_blank" rel="noreferrer">
                {step.cta}
              </a>
            ) : (
              <Link href={step.href}>{step.cta}</Link>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Путь клиента от анкеты до первой встречи: пройденное, текущее, впереди. */
function Journey({ c, solid }: { c: Cabinet; solid: boolean }) {
  const met = c.past.some((s) => s.status === "done");
  const booked = met || c.upcoming.length > 0;
  const picked = booked || Boolean(c.chosen);
  const offered = picked || c.proposals.length > 0;
  const steps = [
    { label: "Анкета", done: true },
    { label: "Подборка", done: offered },
    { label: "Выбор психолога", done: picked },
    { label: booked && !met ? "Встреча назначена" : "Первая встреча", done: met },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map((s, i) => {
        const isCurrent = i === current;
        return (
          <li key={s.label} className="min-w-0">
            <div
              className={cn(
                "h-1.5 rounded-full",
                s.done
                  ? solid ? "bg-white" : "bg-brand-600"
                  : isCurrent
                    ? solid ? "bg-white/50" : "bg-brand-300"
                    : solid ? "bg-white/20" : "bg-brand-100",
              )}
            />
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs leading-tight",
                solid
                  ? s.done || isCurrent ? "text-white" : "text-white/60"
                  : s.done || isCurrent ? "text-neutral-800" : "text-neutral-400",
                isCurrent && "font-medium",
              )}
            >
              {s.done && <IconCheck size={14} className="shrink-0" />}
              <span>{s.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RowIcon({ icon: Icon, tone = "brand" }: { icon: typeof IconUserHeart; tone?: "brand" | "warn" }) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
        tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-600",
      )}
    >
      <Icon size={22} />
    </div>
  );
}

function PsyThumb({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
  ) : (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-bold text-brand-700">
      {name.slice(0, 1)}
    </div>
  );
}

function SummaryRow({
  href,
  title,
  value,
  media,
  warn,
}: {
  href: string;
  title: string;
  value: string;
  media: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-neutral-50">
      {media}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-neutral-500">{title}</div>
        <div className={cn("truncate font-semibold", warn && "text-amber-800")}>{value}</div>
      </div>
      <IconChevronRight size={20} className="shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  );
}

export function PodborBody({ c, variant }: { c: Cabinet; variant: number }) {
  const { req, proposals, chosen, showProposals } = c;
  return (
    <>
          {showProposals ? (
            <section>
              <SectionTitle
                sub={
                  chosen
                    ? "Пока вы не записались, выбор можно поменять — список никуда не денется."
                    : "Посмотрите профили и выберите того, кто откликнется. Если не подойдёт — бесплатно подберём другого."
                }
              >
                Мы подобрали для вас{" "}
                {proposals.length === 1 ? "специалиста" : `${proposals.length} специалистов`}
              </SectionTitle>
              {chosen && (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4">
                  <p className="flex-1 text-sm text-brand-900">
                    Вы выбрали: <span className="font-medium">{chosen.psy.name}</span>. Осталось
                    выбрать время первой встречи.
                  </p>
                  <Button asChild className="rounded-lg">
                    <Link href="/me/vstrechi#booking">Выбрать время</Link>
                  </Button>
                </div>
              )}
              <div className="@container mt-6">
                <ProposalsView variant={variant} anyChosen={Boolean(chosen)} proposals={proposals} />
              </div>
            </section>
          ) : chosen ? (
            <section>
              <SectionTitle>Ваш психолог</SectionTitle>
              <div className="mt-5 flex flex-wrap items-center gap-4">
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
                      href={`/psihologi/${chosen.psy.slug}`}
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
                  специалиста ниже.
                </p>
              )}
            </section>
          ) : (
            <section>
              <SectionTitle sub={waitingText(req.status)}>Подбор психолога</SectionTitle>
              {req.status === "rejected" && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild className="rounded-lg">
                    <Link href="/anketa">Подобрать психолога</Link>
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Второй путь — выбрать самому. Равноправный с подборкой, а не мелкая сноска. */}
          {!chosen || showProposals ? (
            <section className="@container rounded-3xl border border-neutral-200 p-6 sm:p-8">
          <div className="flex flex-col gap-6 @2xl:flex-row @2xl:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IconSearch size={28} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">Хотите выбрать сами?</h2>
                <p className="mt-1 text-neutral-600">
                  Откройте каталог всех проверенных психологов. Фильтры по вашим ответам из анкеты уже
                  включены — их можно поменять. Записаться можно к любому специалисту.
                </p>
              </div>
              <Button asChild size="lg" variant="outline" className="shrink-0">
                <Link href={c.catalogUrl}>Открыть каталог</Link>
              </Button>
          </div>
            </section>
          ) : null}

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

          {/* Запрос со временем меняется: человек мог не выбрать никого и вернуться
              на следующий день с другим вопросом. Имя и контакты заново не спрашиваем. */}
          {c.canRetake && req.status !== "rejected" && (
            <section id="retake" className="border-t border-neutral-100 pt-8">
              <h2 className="text-lg font-bold">Запрос изменился?</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Пройдите анкету заново, и мы подберем специалистов под новый запрос. Имя и
                контакты вводить не нужно, текущая подборка закроется.
              </p>
              <Button asChild variant="outline" className="mt-4 cursor-pointer rounded-lg">
                <Link href="/anketa?retake=1">Пройти анкету заново</Link>
              </Button>
            </section>
          )}

          {c.myRequests.length > 1 && (
            <section className="border-t border-neutral-100 pt-8">
              <h2 className="text-lg font-bold">Прошлые обращения</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                {c.myRequests.slice(1).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span>{r.createdAt.slice(0, 10)}</span>
                    <Badge variant="secondary">{label(REQUEST_STATUS_LABELS, r.status)}</Badge>
                    {r.mainProblem && <span className="text-neutral-500">{r.mainProblem}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-neutral-400">
                Встречи по прошлым обращениям — в разделе «Встречи».
              </p>
            </section>
          )}
    </>
  );
}

export function VstrechiBody({ c }: { c: Cabinet }) {
  const { chosen, upcoming, past, myReviews, calendarSlots, showProposals } = c;
  const nothingYet = !chosen && upcoming.length === 0 && past.length === 0;
  return (
    <>
          <SectionTitle sub={`Время указано ${TZ_LABEL}`}>Встречи</SectionTitle>

          {nothingYet && (
            <section className="rounded-2xl bg-neutral-50 p-6">
              <p className="text-neutral-600">
                Встреч пока нет. Записаться можно, когда выберете психолога.
              </p>
              <Button asChild className="mt-4 rounded-lg">
                <Link href="/me/podbor">Перейти к подбору</Link>
              </Button>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Предстоящие</h2>
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
                            <Link
                              href="/me/oplaty"
                              className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                            >
                              не оплачена
                            </Link>
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
                              className="font-medium text-brand-700 underline"
                            >
                              Ссылка на встречу
                            </a>
                          )}
                        </div>
                      </div>
                      <BookingActions
                        slotId={s.id}
                        startsAt={s.startsAt}
                        canChange={c.canChange(s.startsAt)}
                        freeSlots={c.freeSlotsByPsy(s.psychologistId)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {chosen && (
            <section id="booking" className="scroll-mt-6 border-t border-neutral-100 pt-8">
              <h2 className="text-lg font-bold">
                {upcoming.length > 0 ? "Записаться ещё" : "Выберите время встречи"}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">Специалист: {chosen.psy.name}</p>
              {showProposals && (
                <p className="mt-1 text-xs text-neutral-400">
                  Выбор специалиста можно поменять в разделе{" "}
                  <Link href="/me/podbor" className="underline">
                    «Подбор»
                  </Link>{" "}
                  — пока вы не записались.
                </p>
              )}
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

          {/* Прошедшие: состоявшиеся (с отзывом), неявки и ждущие отметки */}
          {past.length > 0 && (
            <section className="border-t border-neutral-100 pt-8">
              <h2 className="text-lg font-bold">Прошедшие</h2>
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
    
    </>
  );
}

export function OplatyBody({ c }: { c: Cabinet }) {
  const { chosen, upcoming, past, payProviders } = c;
  const unpaid = upcoming.filter((s) => !s.paidAt);
  const paid = [...upcoming, ...past].filter((s) => s.paidAt);
  const price = chosen ? gradePriceLabel(chosen.psy.grade) : null;
  return (
    <>
          <SectionTitle sub={price ? `Сессия с ${chosen!.psy.name} стоит ${price}.` : undefined}>
            Оплаты
          </SectionTitle>

          <section>
            <h2 className="text-lg font-bold">К оплате</h2>
            {unpaid.length === 0 ? (
              <p className="mt-2 text-neutral-500">
                Неоплаченных встреч нет.{" "}
                {upcoming.length === 0 && (
                  <Link href="/me/vstrechi" className="text-brand-700 underline">
                    Записаться на встречу
                  </Link>
                )}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-neutral-100">
                {unpaid.map((s) => {
                  const sessionPrice = gradePriceLabel(s.psyGrade);
                  return (
                    <li key={s.id} className="py-4">
                      <div className="font-medium">{formatSlot(s.startsAt)}</div>
                      <div className="text-sm text-neutral-500">
                        с {s.psyName}
                        {sessionPrice ? ` · ${sessionPrice}` : ""}
                      </div>
                      {sessionPrice && payProviders.length > 0 ? (
                        <PayButtons slotId={s.id} priceLabel={sessionPrice} providers={payProviders} />
                      ) : (
                        <p className="mt-2 text-sm text-neutral-400">
                          Онлайн-оплата на платформе появится позже.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {paid.length > 0 && (
            <section className="border-t border-neutral-100 pt-8">
              <h2 className="text-lg font-bold">Оплачено</h2>
              <ul className="mt-2 divide-y divide-neutral-100 text-sm">
                {paid.map((s) => (
                  <li key={s.id} className="flex flex-wrap justify-between gap-2 py-3">
                    <span>
                      {formatSlot(s.startsAt)} · {s.psyName}
                    </span>
                    <span className="text-neutral-500">{gradePriceLabel(s.psyGrade) ?? ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
    
    </>
  );
}

export function PodderzhkaBody({ c }: { c: Cabinet }) {
  return (
    <>
          <SectionTitle
            sub={`Есть вопрос или что-то пошло не так? Напишите нам — оператор ответит на ${c.req.email ?? c.account.email}.`}
          >
            Поддержка
          </SectionTitle>
          <section>
            <SupportForm />
          </section>
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-900">
              Если станет совсем тяжело — не ждите ответа оператора:{" "}
              <Link href="/crisis" className="font-medium underline">
                телефоны круглосуточной поддержки
              </Link>
              .
            </p>
          </section>
      <section className="flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-100 pt-6 text-sm text-neutral-500">
        <Link href="/privacy" className="hover:text-brand-700">Политика обработки данных</Link>
        <Link href="/oferta" className="hover:text-brand-700">Пользовательское соглашение</Link>
        <Link href="/faq" className="hover:text-brand-700">Частые вопросы</Link>
      </section>
    
    </>
  );
}

export type Step = { title: string; text: string; href?: string; cta?: string; external?: boolean };

/** Один главный шаг для клиента — по состоянию обращения, от срочного к фоновому. */
export function nextStep(c: Cabinet): Step {
  const { req, chosen, showProposals, upcoming, calendarSlots, awaitingReview } = c;
  const next = upcoming[0];

  if (req.status === "rejected") {
    return { title: "Начните новый подбор", text: waitingText(req.status), href: "/anketa", cta: "Подобрать психолога" };
  }
  if (next && !next.paidAt) {
    return {
      title: `Встреча ${formatSlot(next.startsAt)}`,
      text: `Психолог: ${next.psyName}. Встреча ещё не оплачена — оплатить можно заранее.`,
      href: "/me/oplaty",
      cta: "Перейти к оплате",
    };
  }
  if (next) {
    return {
      title: `Встреча ${formatSlot(next.startsAt)}`,
      text: next.meetingLink
        ? `Психолог: ${next.psyName}. Ссылка откроет комнату встречи.`
        : `Психолог: ${next.psyName}. Ссылка на встречу появится здесь ближе ко времени.`,
      href: next.meetingLink ?? "/me/vstrechi",
      cta: next.meetingLink ? "Открыть встречу" : "Подробнее",
      external: Boolean(next.meetingLink),
    };
  }
  if (showProposals && !chosen) {
    return {
      title: "Выберите психолога",
      text: "Мы подобрали специалистов под ваш запрос. Посмотрите профили и выберите того, кто откликнется.",
      href: "/me/podbor",
      cta: "Смотреть подборку",
    };
  }
  if (chosen && req.status !== "rematch") {
    return calendarSlots.length > 0
      ? {
          title: "Запишитесь на первую встречу",
          text: `Психолог: ${chosen.psy.name}. Свободные окна уже открыты — выберите удобное время.`,
          href: "/me/vstrechi#booking",
          cta: "Выбрать время",
        }
      : {
          title: "Ждём расписание психолога",
          text: `Психолог: ${chosen.psy.name}. Свободного времени пока нет — как только появятся окна, их можно будет выбрать в разделе «Встречи».`,
          href: chosen.psy.slug ? `/psihologi/${chosen.psy.slug}` : undefined,
          cta: "Профиль психолога",
        };
  }
  if (awaitingReview.length > 0) {
    return {
      title: "Как прошла встреча?",
      text: "Оценка помогает другим людям выбрать специалиста.",
      href: "/me/vstrechi",
      cta: "Оставить отзыв",
    };
  }
  return { title: "Подбираем специалистов", text: waitingText(req.status) };
}

/** Главная варианта «Плитки»: каждый раздел — плитка с коротким превью. */
export function TilesHome({ c }: { c: Cabinet }) {
  const { req, chosen, proposals, showProposals, upcoming, past, awaitingReview } = c;
  const step = nextStep(c);
  const next = upcoming[0];
  const unpaid = upcoming.filter((s) => !s.paidAt);
  return (
    <>
      <h1 className="text-3xl font-bold">Здравствуйте, {req.name}!</h1>
      <div className="grid auto-rows-[minmax(150px,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:row-span-2">
          <NextStepCard step={step} c={c} tone="solid" />
        </div>

        <Tile href="/me/podbor" title="Подбор" icon={IconUserHeart} badge={showProposals && !chosen ? proposals.length : 0}>
          {chosen ? (
            <div className="flex items-center gap-3">
              {chosen.psy.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chosen.psy.photoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 font-bold text-brand-700">
                  {chosen.psy.name.slice(0, 1)}
                </div>
              )}
              <div>
                <div className="font-semibold">{chosen.psy.name}</div>
                <div className="text-sm text-neutral-500">ваш психолог</div>
              </div>
            </div>
          ) : showProposals ? (
            <div>
              <div className="text-2xl font-bold">{proposals.length}</div>
              <div className="text-sm text-neutral-500">специалиста ждут вашего выбора</div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{waitingText(req.status)}</p>
          )}
        </Tile>

        <Tile href="/me/vstrechi" title="Встречи" icon={IconCalendarEvent} badge={awaitingReview.length}>
          {next ? (
            <div>
              <div className="font-semibold">{formatSlot(next.startsAt)}</div>
              <div className="text-sm text-neutral-500">Психолог: {next.psyName}</div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">Ближайших встреч нет</div>
          )}
          {past.length > 0 && <div className="mt-2 text-xs text-neutral-400">Прошло встреч: {past.length}</div>}
        </Tile>

        <Tile href="/me/oplaty" title="Оплаты" icon={IconCreditCard} badge={unpaid.length}>
          {unpaid.length ? (
            <div>
              <div className="text-2xl font-bold text-amber-700">{unpaid.length}</div>
              <div className="text-sm text-neutral-500">
                {unpaid.length === 1 ? "встреча ждёт оплаты" : "встречи ждут оплаты"}
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">Всё оплачено</div>
          )}
        </Tile>

        <Tile href="/me/podderzhka" title="Поддержка" icon={IconHeadset}>
          <div className="text-sm text-neutral-500">Вопрос, жалоба или что-то не работает — ответим на почту.</div>
        </Tile>

        <Tile href={c.catalogUrl} title="Каталог" icon={IconSearch}>
          <div className="text-sm text-neutral-500">Все проверенные психологи с фильтрами по вашей анкете.</div>
        </Tile>
      </div>

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
    </>
  );
}

function Tile({
  href,
  title,
  icon: Icon,
  badge,
  children,
}: {
  href: string;
  title: string;
  icon: typeof IconUserHeart;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex cursor-pointer flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <Icon size={22} className="text-brand-600" />
        <span className="font-semibold">{title}</span>
        {badge ? (
          <span className="rounded-full bg-brand-600 px-1.5 text-xs font-medium leading-5 text-white">{badge}</span>
        ) : null}
        <IconArrowRight size={18} className="ml-auto text-neutral-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-600" />
      </div>
      <div className="mt-auto pt-5">{children}</div>
    </Link>
  );
}
