import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, slots, topics } from "@/db";
import { Badge } from "@/components/ui/badge";
import { CabinetHeader } from "@/components/site";
import { formatSlot, isPast } from "@/lib/datetime";
import { currentAccount } from "@/lib/auth";
import { gradePriceLabel, gradeTitle } from "@/lib/grades";
import { CalendarFeed } from "./calendar";
import { ProfileForm } from "./profile-form";
import { OutcomeControl, PaidControl, Schedule } from "./schedule";
import { PsySupportForm } from "./support";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

export const metadata = { title: "Кабинет психолога — mipsy" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  new: { label: "Заявка на модерации", tone: "bg-amber-100 text-amber-800" },
  approved: { label: "Профиль одобрен", tone: "bg-brand-100 text-brand-800" },
  rejected: { label: "Заявка отклонена", tone: "bg-red-100 text-red-800" },
};

export default async function CabinetPage() {
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fcab");

  const [psy] = await db
    .select()
    .from(psychologists)
    .where(eq(psychologists.accountId, account.id));

  if (!psy) {
    return (
      <div className="min-h-screen bg-white">
        <CabinetHeader title={account.name} wide />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <section>
            <h1 className="text-2xl font-bold">Кабинета специалиста пока нет</h1>
            {account.role === "client" ? (
              // Одна почта — один кабинет: звать подавать заявку отсюда нельзя,
              // она всё равно будет отклонена на отправке.
              <>
                <p className="mt-3 text-neutral-600">
                  На {account.email} заведён кабинет клиента, а кабинет психолога живёт
                  отдельно — так профиль, заявки и брони не перемешиваются. Хотите работать на
                  платформе специалистом? Войдите с другого адреса и подайте заявку оттуда.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
                  >
                    Войти с другой почты
                  </Link>
                  <Link
                    href="/me"
                    className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
                  >
                    Мой кабинет клиента
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-neutral-600">
                  На эту почту не заведён профиль психолога. Если вы хотите работать на
                  платформе — подайте заявку, мы изучим её и позвоним.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/psy"
                    className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
                  >
                    Подать заявку психолога
                  </Link>
                  <Link
                    href="/me"
                    className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
                  >
                    Мой кабинет клиента
                  </Link>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    );
  }

  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const myMatches = await db
    .select({
      id: matches.id,
      active: matches.active,
      createdAt: matches.createdAt,
      clientName: clientRequests.name,
    })
    .from(matches)
    .innerJoin(clientRequests, eq(matches.clientRequestId, clientRequests.id))
    .where(eq(matches.psychologistId, psy.id))
    .orderBy(desc(matches.createdAt));
  const mySlots = await db
    .select({
      id: slots.id,
      startsAt: slots.startsAt,
      durationMin: slots.durationMin,
      status: slots.status,
      isIntroCall: slots.isIntroCall,
      paidAt: slots.paidAt,
      clientName: clientRequests.name,
    })
    .from(slots)
    .leftJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(eq(slots.psychologistId, psy.id))
    .orderBy(asc(slots.startsAt));
  const now = new Date();
  const upcoming = mySlots.filter((s) => s.status === "booked" && !isPast(s.startsAt, now));
  // Прошедшее целиком: ждущие отметки исхода — первыми, свежие сверху.
  const past = mySlots
    .filter(
      (s) =>
        s.status === "done" ||
        s.status === "no_show" ||
        (s.status === "booked" && isPast(s.startsAt, now)),
    )
    .reverse();

  const status = STATUS_LABELS[psy.moderationStatus] ?? STATUS_LABELS.new;

  return (
    <div className="min-h-screen bg-white">
      <CabinetHeader title={`Кабинет · ${psy.name}`} wide />
      <main className="mx-auto max-w-4xl space-y-12 px-4 py-10">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Здравствуйте, {psy.name}!</h1>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}>
              {status.label}
            </span>
          </div>
          {psy.moderationStatus === "new" && (
            <p className="mt-3 text-neutral-600">
              Мы изучаем вашу заявку и скоро позвоним. А пока можно заполнить профиль ниже — после
              одобрения он сразу станет публичным.
            </p>
          )}
          {psy.moderationStatus === "approved" && psy.slug && (
            <p className="mt-3 text-neutral-600">
              Ваша публичная страница:{" "}
              <Link href={`/p/${psy.slug}`} className="font-medium text-brand-700 underline">
                mipsy…/p/{psy.slug}
              </Link>
              {psy.grade && (
                <>
                  {" · "}грейд «{gradeTitle(psy.grade)}» — сессия {gradePriceLabel(psy.grade)},
                  цену назначает платформа
                </>
              )}
            </p>
          )}
          {psy.moderationStatus === "rejected" && (
            <p className="mt-3 text-neutral-600">
              К сожалению, сейчас мы не можем принять вашу заявку.
              {psy.moderationNotes ? ` Комментарий: ${psy.moderationNotes}` : ""}
            </p>
          )}
        </section>

        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-xl font-bold">Ваши клиенты и записи</h2>
          {myMatches.length === 0 ? (
            <p className="mt-3 text-neutral-500">
              Пока пусто. Когда оператор подберёт вам клиента, он появится здесь.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-neutral-100">
              {myMatches.map((m) => (
                <li key={m.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.clientName}</span>
                    <Badge variant={m.active ? "default" : "secondary"}>
                      {m.active ? "активный клиент" : "завершено"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-neutral-700">Предстоящие встречи</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {formatSlot(s.startsAt)}
                      <span className="text-neutral-500"> · {s.clientName ?? "клиент"}</span>
                    </span>
                    <PaidControl slotId={s.id} paid={Boolean(s.paidAt)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {past.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-neutral-700">Прошедшие встречи</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {past.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                    <span className={s.status === "booked" ? undefined : "text-neutral-500"}>
                      {formatSlot(s.startsAt)} · {s.clientName ?? "клиент"}
                      {s.status === "done" && " · состоялась"}
                      {s.status === "no_show" && " · клиент не пришёл"}
                    </span>
                    <span className="flex items-center gap-2">
                      {/* Оплату часто отмечают уже после сессии — переключатель нужен и здесь. */}
                      {s.status !== "no_show" && <PaidControl slotId={s.id} paid={Boolean(s.paidAt)} />}
                      {s.status === "booked" && <OutcomeControl slotId={s.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-xl font-bold">Расписание</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Откройте часы, когда готовы консультировать. Клиент сможет записаться только в открытое
            время — как только оператор подберёт его вам.
          </p>
          <div className="mt-6">
            <Schedule slots={mySlots} />
          </div>
        </section>

        {psy.calendarToken && (
          <section className="border-t border-neutral-100 pt-8">
            <h2 className="text-xl font-bold">Ваш календарь</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Подпишитесь на эту ссылку в Google, Яндекс или Apple Календаре — записи клиентов
              будут появляться там сами, ничего подгружать не нужно.
            </p>
            <div className="mt-4">
              <CalendarFeed url={`${SITE_URL}/api/calendar/${psy.calendarToken}`} />
            </div>
          </section>
        )}

        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-xl font-bold">Ваш профиль</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Это то, что увидят клиенты. Контакты в профиле указывать нельзя — вся связь идёт через
            платформу.
          </p>
          <div className="mt-6">
            <ProfileForm
              topics={topicList.map((t) => ({ slug: t.slug, title: t.title }))}
              initial={{
                meetingUrl: psy.meetingUrl ?? "",
                photoUrl: psy.photoUrl ?? "",
                approach: psy.approach ?? "",
                about: psy.about ?? "",
                topicSlugs: psy.topicSlugs ?? [],
                howSessions: psy.howSessions ?? "",
                faq: psy.faq ?? [],

              }}
            />
          </div>
        </section>

        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-xl font-bold">Поддержка</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Спорная запись, неявка клиента, вопрос по платформе — напишите, оператор разберётся.
          </p>
          <div className="mt-4">
            <PsySupportForm />
          </div>
        </section>

        <p className="pb-4 text-center text-xs text-neutral-400">
          Вход в кабинет — по адресу {account.email} и коду из письма.
        </p>
      </main>
    </div>
  );
}
