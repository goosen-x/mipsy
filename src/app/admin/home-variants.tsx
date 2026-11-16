import Link from "next/link";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBell,
  IconCalendarEvent,
  IconCash,
  IconFileText,
  IconHeadset,
  IconRefresh,
  IconStar,
  IconUserHeart,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import type { AdminCounts, AttentionItem, AttentionKind } from "@/lib/admin-queue";
import { ageLabel } from "@/lib/admin-queue";
import { label, PROBLEM_LABELS, REQUEST_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";


const KIND: Record<AttentionKind, { icon: typeof IconUsers; label: string; group: string }> = {
  crisis: { icon: IconAlertTriangle, label: "Кризис", group: "clients" },
  request: { icon: IconUserPlus, label: "Заявка", group: "clients" },
  rematch: { icon: IconRefresh, label: "Переподбор", group: "clients" },
  psy: { icon: IconUserHeart, label: "Модерация", group: "psy" },
  "psy-changed": { icon: IconFileText, label: "Правки профиля", group: "psy" },
  review: { icon: IconStar, label: "Отзыв", group: "reviews" },
  ticket: { icon: IconHeadset, label: "Поддержка", group: "support" },
  system: { icon: IconBell, label: "Система", group: "system" },
};

const URGENCY_DOT = ["bg-red-500", "bg-amber-400", "bg-neutral-300"];

function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{children}</h1>
      {sub && <p className="mt-1 text-neutral-500">{sub}</p>}
    </div>
  );
}

/* ================= 1. Дашборд: что требует внимания + цифры недели ================= */

export function DashboardHome({
  counts,
  attention,
  week,
  recent,
}: {
  counts: AdminCounts;
  attention: AttentionItem[];
  week: { requests: number; sessions: number; paid: number; activePsy: number };
  recent: { id: number; name: string; status: string; createdAt: string; mainProblem: string | null; crisisFlag: boolean }[];
}) {
  const tiles = [
    { title: "Кризисные анкеты", value: counts.crisis, href: "/admin/requests?status=new", tone: "red", icon: IconAlertTriangle },
    { title: "Звонок просрочен", value: counts.slaOverdue, href: "/admin/requests?status=new", tone: "amber", icon: IconUserPlus },
    { title: "Новые заявки", value: counts.requestsNew, href: "/admin/requests?status=new", tone: "brand", icon: IconUsers },
    { title: "Переподбор", value: counts.rematch, href: "/admin/requests?status=rematch", tone: "brand", icon: IconRefresh },
    { title: "Психологи на модерации", value: counts.psyModeration + counts.psyChanged, href: "/admin/psy", tone: "brand", icon: IconUserHeart },
    { title: "Отзывы на проверке", value: counts.reviewsPending, href: "/admin/reviews", tone: "brand", icon: IconStar },
    { title: "Открытые обращения", value: counts.ticketsOpen, href: "/admin/support", tone: "brand", icon: IconHeadset },
    { title: "Не ушли уведомления", value: counts.notificationsFailed, href: "/admin/notifications", tone: "amber", icon: IconBell },
  ];
  return (
    <div>
      <PageTitle sub={attention.length ? `Дел в работе: ${attention.length}` : "Срочных дел нет"}>Сводка</PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => {
          const hot = t.value > 0 && (t.tone === "red" || t.tone === "amber");
          return (
            <Link
              key={t.title}
              href={t.href}
              className={cn(
                "group flex items-center gap-4 rounded-2xl border bg-white p-4 transition-colors hover:border-brand-300",
                hot ? (t.tone === "red" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50") : "border-neutral-200",
                t.value === 0 && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  hot ? (t.tone === "red" ? "bg-red-500 text-white" : "bg-amber-400 text-white") : "bg-brand-50 text-brand-600",
                )}
              >
                <t.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-bold leading-none">{t.value}</div>
                <div className="mt-1 truncate text-sm text-neutral-500">{t.title}</div>
              </div>
              <IconArrowRight size={18} className="text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold">Требует внимания</h2>
          <AttentionList items={attention.slice(0, 8)} compact />
          {attention.length > 8 && (
            <Link href="/admin?v=2" className="mt-3 inline-block text-sm text-brand-700 underline">
              Все дела ({attention.length})
            </Link>
          )}
        </section>
        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="font-semibold">За 7 дней</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat icon={IconUsers} value={week.requests} label="новых заявок" />
              <Stat icon={IconCalendarEvent} value={week.sessions} label="сессий" />
              <Stat icon={IconCash} value={`${week.paid.toLocaleString("ru-RU")} ₽`} label="оплачено" />
              <Stat icon={IconUserHeart} value={week.activePsy} label="психологов в каталоге" />
            </div>
            <Link href="/admin/stats" className="mt-4 inline-block text-sm text-brand-700 underline">
              Вся аналитика
            </Link>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Последние заявки</h2>
              <Link href="/admin/requests" className="text-sm text-brand-700 underline">
                Все
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-neutral-100">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-700">
                    <span className="truncate">
                      {r.crisisFlag && "🚨 "}#{r.id} {r.name}
                      {r.mainProblem && <span className="text-neutral-400"> · {label(PROBLEM_LABELS, r.mainProblem)}</span>}
                    </span>
                    <span className="shrink-0 text-neutral-500">{label(REQUEST_STATUS_LABELS, r.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label: text }: { icon: typeof IconUsers; value: React.ReactNode; label: string }) {
  return (
    <div>
      <Icon size={18} className="text-brand-600" />
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="text-sm text-neutral-500">{text}</div>
    </div>
  );
}

function AttentionList({ items, compact }: { items: AttentionItem[]; compact?: boolean }) {
  if (!items.length) return <p className="mt-3 text-sm text-neutral-500">Всё разобрано 🎉</p>;
  return (
    <ul className={cn("divide-y divide-neutral-100", compact ? "mt-2" : "")}>
      {items.map((it, i) => {
        const k = KIND[it.kind];
        return (
          <li key={`${it.href}-${i}`}>
            <Link href={it.href} className="group flex items-center gap-3 py-3 hover:bg-neutral-50 sm:px-2">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", URGENCY_DOT[it.urgency])} />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                <k.icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium group-hover:text-brand-700">{it.title}</div>
                <div className="truncate text-sm text-neutral-500">{it.subtitle}</div>
              </div>
              {!compact && <span className="hidden shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 sm:inline">{k.label}</span>}
              <span className="shrink-0 text-xs text-neutral-400">{ageLabel(it.at)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ================= 2. Входящие: одна очередь дел по срочности ================= */

const INBOX_FILTERS = [
  ["all", "Все"],
  ["clients", "Клиенты"],
  ["psy", "Психологи"],
  ["reviews", "Отзывы"],
  ["support", "Поддержка"],
  ["system", "Система"],
] as const;

export function InboxHome({ attention, filter }: { attention: AttentionItem[]; filter: string }) {
  const visible = filter === "all" ? attention : attention.filter((it) => KIND[it.kind].group === filter);
  const count = (f: string) => (f === "all" ? attention.length : attention.filter((it) => KIND[it.kind].group === f).length);
  const hot = attention.filter((it) => it.urgency === 0).length;
  return (
    <div className="max-w-4xl">
      <PageTitle sub={hot ? `Горит: ${hot}. Сверху — самое срочное.` : "Сверху — самое срочное."}>Входящие</PageTitle>
      <div className="flex flex-wrap gap-2">
        {INBOX_FILTERS.map(([k, title]) => (
          <Link
            key={k}
            href={`/admin?v=2${k === "all" ? "" : `&f=${k}`}`}
            scroll={false}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm",
              filter === k ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-200 bg-white hover:border-brand-400",
            )}
          >
            {title} <span className={filter === k ? "text-white/70" : "text-neutral-400"}>{count(k)}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-3 sm:px-4">
        <AttentionList items={visible} />
      </div>
      <div className="mt-3 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> горит
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> сегодня
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-300" /> в рабочем порядке
        </span>
      </div>
    </div>
  );
}

/* ================= 3. Воронка: заявки по колонкам статусов ================= */

type BoardRequest = { id: number; name: string; status: string; createdAt: string; mainProblem: string | null; crisisFlag: boolean };
type BoardPsy = { id: number; name: string; moderationStatus: string; needsReview: boolean; createdAt: string };

const COLUMNS = [
  { status: "new", title: "Новые", hint: "позвонить в течение дня" },
  { status: "called", title: "Позвонили", hint: "подобрать специалистов" },
  { status: "matched", title: "Подобран", hint: "ждём выбора и записи" },
  { status: "rematch", title: "Переподбор", hint: "предложить другого" },
];

export function PipelineHome({ requests, psys }: { requests: BoardRequest[]; psys: BoardPsy[] }) {
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const psyColumns = [
    { title: "Черновик", hint: "ещё не прислал документы", items: psys.filter((p) => p.moderationStatus === "draft") },
    { title: "На модерации", hint: "проверить документы", items: psys.filter((p) => p.moderationStatus === "new") },
    { title: "Правки профиля", hint: "вычитать изменения", items: psys.filter((p) => p.needsReview) },
  ];
  return (
    <div>
      <PageTitle sub={`Отказов: ${rejected} — во вкладке «Отказ» в списке заявок`}>Воронка</PageTitle>
      <h2 className="mb-3 font-semibold">Клиенты</h2>
      <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = requests.filter((r) => r.status === col.status);
          return (
            <section key={col.status} className="flex min-w-60 flex-col rounded-2xl bg-neutral-100/80 p-3">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="font-semibold">{col.title}</h3>
                <span className="text-sm text-neutral-500">{items.length}</span>
              </div>
              <div className="px-1 text-xs text-neutral-500">{col.hint}</div>
              <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
                {items.length === 0 && <div className="rounded-xl border border-dashed border-neutral-300 p-3 text-center text-xs text-neutral-400">пусто</div>}
                {items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/requests/${r.id}`}
                    className={cn(
                      "block rounded-xl border bg-white p-3 text-sm shadow-sm transition-colors hover:border-brand-300",
                      r.crisisFlag ? "border-red-300" : "border-transparent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="shrink-0 text-xs text-neutral-400">#{r.id}</span>
                    </div>
                    {r.mainProblem && <div className="mt-0.5 truncate text-neutral-500">{label(PROBLEM_LABELS, r.mainProblem)}</div>}
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {r.crisisFlag && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">кризис</span>}
                      <span className="text-neutral-400">{ageLabel(r.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 font-semibold">Психологи</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {psyColumns.map((col) => (
          <section key={col.title} className="flex flex-col rounded-2xl bg-neutral-100/80 p-3">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="font-semibold">{col.title}</h3>
              <span className="text-sm text-neutral-500">{col.items.length}</span>
            </div>
            <div className="px-1 text-xs text-neutral-500">{col.hint}</div>
            <div className="mt-3 space-y-2">
              {col.items.length === 0 && <div className="rounded-xl border border-dashed border-neutral-300 p-3 text-center text-xs text-neutral-400">пусто</div>}
              {col.items.map((p) => (
                <Link key={p.id} href={`/admin/psy/${p.id}`} className="block rounded-xl bg-white p-3 text-sm shadow-sm hover:ring-1 hover:ring-brand-300">
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-1 text-xs text-neutral-400">{ageLabel(p.createdAt)}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
