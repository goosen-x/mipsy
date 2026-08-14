import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, slots, topics } from "@/db";
import { formatSlot } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import {
  FREQ_LABELS,
  GENDER_LABELS,
  label,
  LIFE_IMPACT_LABELS,
  PREF_AGE_LABELS,
  PREF_GENDER_LABELS,
  PROBLEM_LABELS,
  THERAPY_EXP_LABELS,
  TIME_LABELS,
} from "@/lib/labels";
import {
  AssignControl,
  BookSlotControl,
  DropProposalButton,
  FreeSlotButton,
  RequestEmailControl,
  RequestNotesControl,
  RequestStatusControl,
  SendProposalsButton,
} from "../../controls";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [req] = await db
    .select()
    .from(clientRequests)
    .where(eq(clientRequests.id, Number(id)));
  if (!req) notFound();

  const allTopics = await db.select().from(topics);
  const topicTitles = (req.topicSlugs ?? []).map(
    (s) => allTopics.find((t) => t.slug === s)?.title ?? s,
  );

  const reqMatches = await db
    .select({
      id: matches.id,
      active: matches.active,
      chosen: matches.chosen,
      note: matches.note,
      createdAt: matches.createdAt,
      psyName: psychologists.name,
    })
    .from(matches)
    .innerJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(eq(matches.clientRequestId, req.id))
    .orderBy(desc(matches.createdAt));

  const activeProposals = reqMatches.filter((m) => m.active).length;

  const [activeMatch] = await db
    .select({ psychologistId: matches.psychologistId })
    .from(matches)
    .where(
      and(
        eq(matches.clientRequestId, req.id),
        eq(matches.active, true),
        eq(matches.chosen, true),
      ),
    );

  const bookedSlots = await db
    .select()
    .from(slots)
    .where(eq(slots.clientRequestId, req.id))
    .orderBy(asc(slots.startsAt));

  const freeSlots = activeMatch
    ? await db
        .select()
        .from(slots)
        .where(and(eq(slots.psychologistId, activeMatch.psychologistId), eq(slots.status, "free")))
        .orderBy(asc(slots.startsAt))
    : [];

  const candidates = await db
    .select({ id: psychologists.id, name: psychologists.name })
    .from(psychologists)
    .where(eq(psychologists.moderationStatus, "approved"));

  const screening: [string, string][] = [
    ["Подавленность", label(FREQ_LABELS, req.freqDown)],
    ["Проблемы со сном", label(FREQ_LABELS, req.freqSleep)],
    ["Мысли о самоповреждении", label(FREQ_LABELS, req.freqSelfHarm)],
    ["Влияние на жизнь", label(LIFE_IMPACT_LABELS, req.lifeImpact)],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-brand-700">
          ← Все заявки
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            Заявка #{req.id} · {req.name}
            {req.crisisFlag && (
              <Badge variant="destructive" className="ml-3 align-middle">
                🚨 кризисная
              </Badge>
            )}
          </h1>
          <RequestStatusControl id={req.id} status={req.status} />
        </div>
        <p className="mt-1 text-neutral-500">
          {req.createdAt.slice(0, 16)}
          {req.email && (
            <>
              {" · "}
              <span className="font-medium text-neutral-900">{req.email}</span>
            </>
          )}
          {req.phone && (
            <>
              {" · тел. "}
              <span className="font-medium text-neutral-900">{req.phone}</span>
            </>
          )}
        </p>
      </div>

      {req.status === "rematch" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Клиент попросил другого специалиста.</strong>
          {req.rematchReason ? ` Причина: «${req.rematchReason}»` : " Причину не указал."} Прежние
          записи освобождены — подберите нового психолога ниже.
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        {req.email ? (
          <>
            <span className="text-neutral-500">Личный кабинет: </span>
            <span className="font-medium text-neutral-900">{req.email}</span>
            <p className="mt-1 text-xs text-neutral-400">
              Клиент входит на mipsy…/login по этому адресу — код приходит письмом. В кабинете он
              выбирает время и может попросить переподбор. Если письмо не дошло, код виден в{" "}
              <Link href="/admin/notifications" className="underline">
                очереди уведомлений
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <span className="text-neutral-500">Почты нет — клиент не сможет войти в кабинет.</span>
            <p className="mt-1 text-xs text-neutral-400">
              Спросите адрес по телефону и впишите: заявка привяжется к кабинету.
            </p>
            <RequestEmailControl id={req.id} />
          </>
        )}
      </div>

      {req.crisisFlag && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          В анкете тревожный ответ о самоповреждении ({label(FREQ_LABELS, req.freqSelfHarm)}).
          Позвоните в первую очередь; клиент видел экран с телефонами экстренной поддержки.
        </div>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Анкета</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Для кого" v="Для себя" />
          <Row k="Пол" v={label(GENDER_LABELS, req.gender)} />
          <Row k="Возраст" v={req.age ? String(req.age) : "—"} />
          <Row k="Опыт терапии" v={label(THERAPY_EXP_LABELS, req.therapyExperience)} />
          <Row k="Основная проблема" v={label(PROBLEM_LABELS, req.mainProblem)} />
          <Row k="Темы" v={topicTitles.join(", ") || "—"} />
          {req.topicOther && <Row k="Темы (другое)" v={req.topicOther} />}
          {screening.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
          <Row k="Пол психолога" v={label(PREF_GENDER_LABELS, req.prefGender)} />
          <Row k="Возраст психолога" v={label(PREF_AGE_LABELS, req.prefAge)} />
          <Row
            k="Удобное время"
            v={(req.preferredTime ?? []).map((t) => label(TIME_LABELS, t)).join(", ") || "—"}
          />
        </dl>
        {req.story && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase text-neutral-400">Рассказ клиента</div>
            <p className="mt-1 whitespace-pre-line text-neutral-800">{req.story}</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Подбор</h2>
        {reqMatches.length > 0 && (
          <ul className="mt-3 space-y-2">
            {reqMatches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <span>
                  {m.psyName}
                  {m.note && <span className="text-neutral-500"> — {m.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={m.chosen ? "default" : m.active ? "secondary" : "outline"}>
                    {m.chosen ? "выбран клиентом" : m.active ? "предложен" : "снят"}
                  </Badge>
                  {m.active && !m.chosen && <DropProposalButton requestId={req.id} matchId={m.id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {activeProposals > 0 && (
          <div className="mt-4">
            <SendProposalsButton requestId={req.id} />
            <p className="mt-1 text-xs text-neutral-500">
              Клиент увидит {activeProposals === 1 ? "одного специалиста" : `${activeProposals} специалистов`} на своей странице и выберет сам. Оптимально — 2–3 варианта.
            </p>
          </div>
        )}
        <div className="mt-4">
          <AssignControl requestId={req.id} candidates={candidates} />
        </div>
        {activeMatch && (
          <div className="mt-5 border-t pt-4">
            <h3 className="text-sm font-semibold text-neutral-600">Встречи</h3>
            {bookedSlots.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {bookedSlots.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span>
                      {formatSlot(s.startsAt)} · {s.durationMin} мин
                      {s.isIntroCall && " · знакомство"}
                    </span>
                    {s.status === "booked" && <FreeSlotButton requestId={req.id} slotId={s.id} />}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <BookSlotControl
                requestId={req.id}
                freeSlots={freeSlots.map((s) => ({
                  id: s.id,
                  label: `${formatSlot(s.startsAt)}${s.isIntroCall ? " · знакомство" : ""}`,
                }))}
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Пометки админа</h2>
        <div className="mt-3">
          <RequestNotesControl id={req.id} notes={req.operatorNotes ?? ""} />
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-1.5">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
