import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, slots } from "@/db";
import { Badge } from "@/components/ui/badge";
import { canClientChange, formatSlot, isPast, TZ_LABEL } from "@/lib/datetime";
import { BookingActions, BookingSection, RematchControl } from "./controls";

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

  const [match] = await db
    .select({ id: matches.id, psy: psychologists })
    .from(matches)
    .innerJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(and(eq(matches.clientRequestId, req.id), eq(matches.active, true)));

  const now = new Date();
  const mySlots = await db
    .select()
    .from(slots)
    .where(eq(slots.clientRequestId, req.id))
    .orderBy(asc(slots.startsAt));
  const freeSlots = match
    ? (
        await db
          .select()
          .from(slots)
          .where(and(eq(slots.psychologistId, match.psy.id), eq(slots.status, "free")))
          .orderBy(asc(slots.startsAt))
      ).filter((s) => !isPast(s.startsAt, now))
    : [];

  const upcoming = mySlots.filter((s) => s.status === "booked" && !isPast(s.startsAt, now));

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
        {/* Статус подбора */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Здравствуйте, {req.name}!</h1>
          {req.status === "new" && (
            <p className="mt-3 text-neutral-600">
              Ваша анкета у оператора. Мы позвоним на {req.phone} в течение рабочего дня, чтобы
              уточнить детали и подобрать специалиста.
            </p>
          )}
          {req.status === "called" && (
            <p className="mt-3 text-neutral-600">
              Мы уже пообщались и подбираем для вас психолога. Как только он появится здесь — можно
              будет выбрать время встречи.
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

        {/* Подобранный психолог */}
        {match && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Ваш психолог</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {match.psy.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={match.psy.photoUrl}
                  alt={match.psy.name}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700">
                  {match.psy.name.slice(0, 1)}
                </div>
              )}
              <div className="flex-1">
                <div className="text-xl font-semibold">{match.psy.name}</div>
                <div className="text-neutral-500">{match.psy.approach}</div>
                <div className="mt-1 text-sm text-neutral-600">
                  {match.psy.price || "стоимость уточняется"} · первая встреча бесплатно
                </div>
                {match.psy.slug && (
                  <Link
                    href={`/p/${match.psy.slug}`}
                    className="mt-1 inline-block text-sm text-brand-700 underline"
                  >
                    Открыть профиль
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Мои встречи */}
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
                    </div>
                    <BookingActions
                      token={token}
                      slotId={s.id}
                      startsAt={s.startsAt}
                      canChange={canClientChange(s.startsAt, now)}
                      freeSlots={freeSlots.map((f) => ({
                        id: f.id,
                        startsAt: f.startsAt,
                        durationMin: f.durationMin,
                        isIntroCall: f.isIntroCall,
                      }))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Свободное время */}
        {match && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Выберите время встречи</h2>
            {freeSlots.length === 0 ? (
              <p className="mt-3 text-neutral-500">
                Свободного времени пока нет — специалист скоро откроет расписание. Оператор
                поможет договориться, если нужно срочно.
              </p>
            ) : (
              <div className="mt-4">
                <BookingSection
                  token={token}
                  slots={freeSlots.map((s) => ({
                    id: s.id,
                    startsAt: s.startsAt,
                    durationMin: s.durationMin,
                    isIntroCall: s.isIntroCall,
                  }))}
                />
              </div>
            )}
          </section>
        )}

        {/* Оплата — пока без онлайн-платежей */}
        {match && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Оплата</h2>
            <p className="mt-2 text-neutral-600">
              Первая встреча бесплатная — платить за неё не нужно. Последующие сессии
              {match.psy.price ? ` стоят ${match.psy.price} и ` : " "}
              оплачиваются напрямую специалисту, как вы договоритесь.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Онлайн-оплата на платформе появится позже.
            </p>
          </section>
        )}

        {/* Переподбор */}
        {match && req.status !== "rematch" && (
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
