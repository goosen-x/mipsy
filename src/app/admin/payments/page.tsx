import { desc, eq } from "drizzle-orm";
import { accounts, db, paymentLog, payments, psychologists, slots } from "@/db";
import { Badge } from "@/components/ui/badge";
import { formatDbTime, formatSlot, isPast } from "@/lib/datetime";
import { requireAdmin } from "../require-admin";
import { PayoutButton } from "./payout-button";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  yookassa: "ЮKassa",
  cloudpayments: "CloudPayments",
};

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: "не завершён", tone: "text-neutral-500" },
  succeeded: { label: "оплачен", tone: "text-green-700" },
  canceled: { label: "отменён", tone: "text-neutral-400" },
};

function rub(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export default async function PaymentsPage() {
  await requireAdmin();

  const rows = await db
    .select({
      payment: payments,
      slot: slots,
      psyId: psychologists.id,
      psyName: psychologists.name,
      payerName: accounts.name,
      payerEmail: accounts.email,
    })
    .from(payments)
    .innerJoin(slots, eq(payments.slotId, slots.id))
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .leftJoin(accounts, eq(payments.accountId, accounts.id))
    .orderBy(desc(payments.id));

  const events = await db.select().from(paymentLog).orderBy(desc(paymentLog.id)).limit(50);

  const now = new Date();
  const succeeded = rows.filter((r) => r.payment.status === "succeeded");

  // Готово к выплате: встреча состоялась, оплата на брони жива, психологу ещё
  // не выплачено. Ровно этот же расчёт повторяет серверный экшен выплаты.
  const ready = succeeded.filter(
    (r) =>
      r.payment.paidOutAt === null &&
      isPast(r.slot.startsAt, now) &&
      r.slot.paidAt !== null &&
      (r.slot.status === "booked" || r.slot.status === "done"),
  );

  // Оплата есть, а брони больше нет: встречу отменили или психолог отметил
  // неявку. Деньги у платформы — оператор решает: возврат или удержание.
  const orphaned = succeeded.filter(
    (r) =>
      r.payment.paidOutAt === null &&
      (r.slot.paidAt === null || (r.slot.status !== "booked" && r.slot.status !== "done")),
  );

  // Оплаченные встречи, которые ещё впереди, — деньги на «холде» до сессии.
  const upcoming = succeeded.filter(
    (r) =>
      r.payment.paidOutAt === null &&
      !isPast(r.slot.startsAt, now) &&
      r.slot.paidAt !== null &&
      r.slot.status === "booked",
  );

  const real = (list: typeof rows) => list.filter((r) => !r.payment.testMode);
  const sum = (list: typeof rows) => list.reduce((acc, r) => acc + r.payment.amount, 0);
  const paidOut = succeeded.filter((r) => r.payment.paidOutAt !== null);

  const byPsy = new Map<number, { name: string; items: typeof rows }>();
  for (const r of ready) {
    const group = byPsy.get(r.psyId) ?? { name: r.psyName, items: [] };
    group.items.push(r);
    byPsy.set(r.psyId, group);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Оплаты</h1>

      <section className="grid gap-4 sm:grid-cols-4">
        <Kpi title="Поступило" value={rub(sum(real(succeeded)))} note="боевые платежи" />
        <Kpi
          title="К выплате"
          value={rub(sum(real(ready)))}
          note="за состоявшиеся встречи"
          tone={real(ready).length > 0 ? "warn" : undefined}
        />
        <Kpi title="Выплачено" value={rub(sum(real(paidOut)))} note="психологам" />
        <Kpi
          title="Ждёт сессии"
          value={rub(sum(real(upcoming)))}
          note="оплачено, встреча впереди"
        />
      </section>

      <section className="rounded-2xl border border-neutral-100 p-6">
        <h2 className="text-lg font-bold">Реестр выплат психологам</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Сюда попадают успешные платежи за уже состоявшиеся встречи. Кнопка помечает всё готовое
          по специалисту — сам перевод делается вне платформы и фиксируется здесь.
        </p>
        {byPsy.size === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">Выплачивать пока нечего.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {[...byPsy.entries()].map(([psyId, group]) => (
              <div key={psyId} className="rounded-xl border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{group.name}</div>
                    <div className="text-sm text-neutral-500">
                      {group.items.length} платежей на {rub(sum(group.items))}
                      {group.items.some((r) => r.payment.testMode) && (
                        <span className="text-amber-600"> · включая тестовые</span>
                      )}
                    </div>
                  </div>
                  <PayoutButton psychologistId={psyId} />
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {group.items.map((r) => (
                    <li key={r.payment.id} className="flex flex-wrap justify-between gap-2">
                      <span className="text-neutral-600">
                        {formatSlot(r.slot.startsAt)} · {r.payerName ?? "клиент без аккаунта"}
                      </span>
                      <span>
                        {r.payment.testMode && <TestBadge />} {rub(r.payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {orphaned.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-amber-900">Требует внимания</h2>
          <p className="mt-1 text-sm text-amber-800">
            Платёж прошёл, но брони на встречу больше нет — её отменили, либо специалист отметил
            неявку. Решите вручную: вернуть деньги клиенту или удержать по правилу 24 часов.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {orphaned.map((r) => (
              <li key={r.payment.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {r.payerName ?? "клиент"} ({r.payerEmail ?? "—"}) → {r.psyName},{" "}
                  {formatSlot(r.slot.startsAt)}
                </span>
                <span className="font-medium">
                  {r.payment.testMode && <TestBadge />} {rub(r.payment.amount)} ·{" "}
                  {PROVIDER_LABELS[r.payment.provider] ?? r.payment.provider}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-neutral-100 p-6">
        <h2 className="text-lg font-bold">Все платежи</h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">Платежей ещё не было.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="py-2 pr-4 font-normal">Создан</th>
                  <th className="py-2 pr-4 font-normal">Клиент</th>
                  <th className="py-2 pr-4 font-normal">Специалист</th>
                  <th className="py-2 pr-4 font-normal">Встреча</th>
                  <th className="py-2 pr-4 font-normal">Сумма</th>
                  <th className="py-2 pr-4 font-normal">Провайдер</th>
                  <th className="py-2 pr-4 font-normal">Статус</th>
                  <th className="py-2 font-normal">Выплата</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS_LABELS[r.payment.status] ?? {
                    label: r.payment.status,
                    tone: "text-neutral-500",
                  };
                  return (
                    <tr key={r.payment.id} className="border-b border-neutral-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-neutral-500">
                        {formatDbTime(r.payment.createdAt)}
                      </td>
                      <td className="py-2 pr-4">{r.payerName ?? "—"}</td>
                      <td className="py-2 pr-4">{r.psyName}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatSlot(r.slot.startsAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">
                        {rub(r.payment.amount)}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {PROVIDER_LABELS[r.payment.provider] ?? r.payment.provider}
                        {r.payment.testMode && (
                          <>
                            {" "}
                            <TestBadge />
                          </>
                        )}
                      </td>
                      <td className={`py-2 pr-4 whitespace-nowrap ${st.tone}`}>{st.label}</td>
                      <td className="py-2 whitespace-nowrap text-neutral-500">
                        {r.payment.paidOutAt ? formatDbTime(r.payment.paidOutAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-100 p-6">
        <h2 className="text-lg font-bold">Журнал событий</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Каждый шаг платежа: создание, вебхуки провайдеров (включая отклонённые), проверка и
          отметка оплаты. Последние 50 записей, свежие сверху.
        </p>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">Событий ещё не было.</p>
        ) : (
          <ul className="mt-4 space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2 border-b border-neutral-100 py-1.5">
                <span className="whitespace-nowrap text-neutral-400">
                  {formatDbTime(e.createdAt)}
                </span>
                {e.paymentId !== null && (
                  <span className="whitespace-nowrap text-neutral-400">№{e.paymentId}</span>
                )}
                {e.provider && (
                  <span className="whitespace-nowrap text-neutral-400">
                    {PROVIDER_LABELS[e.provider] ?? e.provider}
                  </span>
                )}
                <span className={e.event.includes("отклон") ? "text-amber-700" : ""}>
                  {e.event}
                </span>
                {e.detail && <span className="text-neutral-500">· {e.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TestBadge() {
  return <Badge variant="outline">тест</Badge>;
}

function Kpi({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone?: "warn";
}) {
  return (
    <div className="border-l-2 border-brand-200 py-1 pl-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === "warn" ? "text-amber-600" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-neutral-400">{note}</div>
    </div>
  );
}
