import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatSlot, TZ_LABEL } from "@/lib/datetime";
import { BookingActions, BookingSection, ReviewForm } from "../controls";
import { loadCabinet } from "../data";
import { CabinetShell, cabinetBadges, SectionTitle } from "../shell";

export const metadata = { title: "Встречи — mipsy" };
export const dynamic = "force-dynamic";

export default async function VstrechiPage() {
  const c = await loadCabinet("/me/vstrechi");
  const { chosen, upcoming, past, myReviews, calendarSlots, showProposals } = c;
  const nothingYet = !chosen && upcoming.length === 0 && past.length === 0;

  return (
    <CabinetShell active="vstrechi" badges={cabinetBadges(c)}>
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
    </CabinetShell>
  );
}
