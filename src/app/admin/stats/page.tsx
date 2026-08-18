import { and, eq, isNotNull } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, slots } from "@/db";
import { dbTimeMskDay, isPast, nowMsk } from "@/lib/datetime";
import { requireAdmin } from "../require-admin";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  await requireAdmin();

  const requests = await db.select().from(clientRequests);
  const allMatches = await db.select().from(matches);
  const allSlots = await db.select().from(slots);
  const psyList = await db.select().from(psychologists);

  const now = new Date();
  const today = nowMsk(now).slice(0, 10);

  // Воронка. Источник заявки различаем по пометке подбора: из каталога человек
  // приходит сразу с активной привязкой «выбрал сам».
  const selfPicked = new Set(
    allMatches.filter((m) => m.note === "выбрал сам в каталоге").map((m) => m.clientRequestId),
  );
  const withMatch = new Set(allMatches.map((m) => m.clientRequestId));
  const booked = allSlots.filter((s) => s.status === "booked" || s.status === "done");
  const withBooking = new Set(booked.map((s) => s.clientRequestId).filter(Boolean) as number[]);
  const held = booked.filter((s) => isPast(s.startsAt, now));

  const funnel = [
    { label: "Заявки всего", value: requests.length },
    { label: "Из них через анкету", value: requests.length - selfPicked.size },
    { label: "Из них сразу из каталога", value: selfPicked.size },
    { label: "Подобран психолог", value: withMatch.size },
    { label: "Записались на встречу", value: withBooking.size },
    { label: "Встреча состоялась", value: held.length },
  ];

  const byStatus = ["new", "called", "matched", "rematch", "rejected"].map((s) => ({
    label: s,
    value: requests.filter((r) => r.status === s).length,
  }));

  // Заявки по дням за две недели.
  // Дни считаем по МСК с обеих сторон: created_at в базе — UTC, и без
  // конвертации заявки после 21:00 UTC падали «во вчера».
  const days: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = nowMsk(new Date(now.getTime() - i * 86400000)).slice(0, 10);
    days.push({ day: d, count: requests.filter((r) => dbTimeMskDay(r.createdAt) === d).length });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const crisis = requests.filter((r) => r.crisisFlag).length;
  const unhandled = requests.filter((r) => r.status === "new").length;
  const approvedPsy = psyList.filter((p) => p.moderationStatus === "approved");
  const freeFuture = allSlots.filter((s) => s.status === "free" && !isPast(s.startsAt, now));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Аналитика</h1>

      <section className="grid gap-4 sm:grid-cols-4">
        <Kpi title="Заявок всего" value={requests.length} />
        <Kpi title="Не обработано" value={unhandled} tone={unhandled > 0 ? "warn" : undefined} />
        <Kpi title="Кризисных" value={crisis} tone={crisis > 0 ? "alert" : undefined} />
        <Kpi title="Записей на встречи" value={booked.length} />
      </section>

      <section className="rounded-2xl border border-neutral-100 p-6">
        <h2 className="text-lg font-bold">Воронка</h2>
        <div className="mt-4 space-y-2">
          {funnel.map((f) => {
            const pct = requests.length > 0 ? Math.round((f.value / requests.length) * 100) : 0;
            return (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-56 text-sm text-neutral-600">{f.label}</div>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-neutral-100">
                  <div
                    className="h-full rounded-lg bg-brand-500"
                    style={{ width: `${Math.max(pct, f.value > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="w-20 text-right text-sm font-medium">
                  {f.value} <span className="text-neutral-400">· {pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-100 p-6">
        <h2 className="text-lg font-bold">Заявки за две недели</h2>
        <div className="mt-4 flex h-32 items-end gap-1">
          {days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${d.day === today ? "bg-accent-500" : "bg-brand-400"}`}
                style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 4 : 1 }}
                title={`${d.day}: ${d.count}`}
              />
              <span className="text-[10px] text-neutral-400">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-100 p-6">
          <h2 className="text-lg font-bold">Статусы заявок</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {byStatus.map((s) => (
              <li key={s.label} className="flex justify-between border-b border-neutral-100 py-1">
                <span className="text-neutral-500">{s.label}</span>
                <span className="font-medium">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-neutral-100 p-6">
          <h2 className="text-lg font-bold">Предложение</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <Row k="Психологов одобрено" v={approvedPsy.length} />
            <Row k="Ждут модерации" v={psyList.filter((p) => p.moderationStatus === "new").length} />
            <Row k="Изменили профиль после одобрения" v={psyList.filter((p) => p.needsReview).length} />
            <Row k="Свободных окон впереди" v={freeFuture.length} />
          </ul>
          {approvedPsy.length > 0 && freeFuture.length === 0 && (
            <p className="mt-3 text-sm text-amber-700">
              Ни одного свободного окна — клиенты не смогут записаться.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ title, value, tone }: { title: string; value: number; tone?: "warn" | "alert" }) {
  const color =
    tone === "alert" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-neutral-900";
  return (
    <div className="border-l-2 border-brand-200 py-1 pl-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <li className="flex justify-between border-b border-neutral-100 py-1">
      <span className="text-neutral-500">{k}</span>
      <span className="font-medium">{v}</span>
    </li>
  );
}
