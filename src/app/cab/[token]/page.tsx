import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, slots, topics } from "@/db";
import { Badge } from "@/components/ui/badge";
import { formatSlot, isPast } from "@/lib/datetime";
import { hasAccess } from "@/lib/access";
import { PsyGate } from "./gate";
import { ProfileForm } from "./profile-form";
import { OutcomeControl, Schedule } from "./schedule";

export const metadata = { title: "Кабинет психолога — mipsy" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  new: { label: "Заявка на модерации", tone: "bg-amber-100 text-amber-800" },
  approved: { label: "Профиль одобрен", tone: "bg-brand-100 text-brand-800" },
  rejected: { label: "Заявка отклонена", tone: "bg-red-100 text-red-800" },
};

export default async function CabinetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [psy] = await db.select().from(psychologists).where(eq(psychologists.cabinetToken, token));
  if (!psy) notFound();
  if (!(await hasAccess("cab", token))) return <PsyGate token={token} />;

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
      clientName: clientRequests.name,
    })
    .from(slots)
    .leftJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(eq(slots.psychologistId, psy.id))
    .orderBy(asc(slots.startsAt));
  const now = new Date();
  const booked = mySlots.filter((s) => s.status === "booked");
  const finished = mySlots.filter((s) => s.status === "done" || s.status === "no_show");

  const status = STATUS_LABELS[psy.moderationStatus] ?? STATUS_LABELS.new;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-brand-700">
            mipsy
          </Link>
          <div className="text-sm text-neutral-500">Кабинет · {psy.name}</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
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
            </p>
          )}
          {psy.moderationStatus === "rejected" && (
            <p className="mt-3 text-neutral-600">
              К сожалению, сейчас мы не можем принять вашу заявку.
              {psy.moderationNotes ? ` Комментарий: ${psy.moderationNotes}` : ""}
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Ваши клиенты и записи</h2>
          {myMatches.length === 0 ? (
            <p className="mt-3 text-neutral-500">
              Пока пусто. Когда оператор подберёт вам клиента, он появится здесь.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {myMatches.map((m) => (
                <li key={m.id} className="rounded-xl border p-4">
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
          {booked.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {booked.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {formatSlot(s.startsAt)}
                    <span className="text-neutral-500">
                      {" · "}
                      {s.clientName ?? "клиент"}
                      {s.isIntroCall && " · первая встреча"}
                    </span>
                  </span>
                  {isPast(s.startsAt, now) && <OutcomeControl token={token} slotId={s.id} />}
                </li>
              ))}
            </ul>
          )}
          {finished.length > 0 && (
            <ul className="mt-4 space-y-1 border-t pt-4 text-sm text-neutral-500">
              {finished.map((s) => (
                <li key={s.id}>
                  {formatSlot(s.startsAt)} · {s.clientName ?? "клиент"} ·{" "}
                  {s.status === "done" ? "состоялась" : "клиент не пришёл"}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Расписание</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Откройте часы, когда готовы консультировать. Клиент сможет записаться только в открытое
            время — как только оператор подберёт его вам.
          </p>
          <div className="mt-6">
            <Schedule token={token} slots={mySlots} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Ваш профиль</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Это то, что увидят клиенты. Контакты в профиле указывать нельзя — вся связь идёт через
            платформу.
          </p>
          <div className="mt-6">
            <ProfileForm
              token={token}
              topics={topicList.map((t) => ({ slug: t.slug, title: t.title }))}
              initial={{
                meetingUrl: psy.meetingUrl ?? "",
                photoUrl: psy.photoUrl ?? "",
                approach: psy.approach ?? "",
                format: psy.format ?? "",
                price: psy.price ?? "",
                about: psy.about ?? "",
                topicSlugs: psy.topicSlugs ?? [],
                howSessions: psy.howSessions ?? "",
                faq: psy.faq ?? [],
                introCallEnabled: psy.introCallEnabled,
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
