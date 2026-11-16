import Link from "next/link";
import { desc } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { clientRequests, db } from "@/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { label, PROBLEM_LABELS, REQUEST_STATUS_LABELS } from "@/lib/labels";
import { requireAdmin } from "../require-admin";
import { dbTimeAgeHours, formatDbTime } from "@/lib/datetime";

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  called: "secondary",
  matched: "outline",
  rejected: "destructive",
};

const TABS = [
  ["new", "Новые"],
  ["called", "Позвонили"],
  ["matched", "Подобран"],
  ["rematch", "Переподбор"],
  ["rejected", "Отказ"],
  ["all", "Все"],
] as const;

export default async function RequestsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = TABS.some(([k]) => k === sp.status) ? sp.status! : "all";
  const q = (sp.q ?? "").trim().toLowerCase();

  const all = await db.select().from(clientRequests).orderBy(desc(clientRequests.createdAt));
  const count = (k: string) => (k === "all" ? all.length : all.filter((r) => r.status === k).length);
  // Поиск по имени, почте, телефону и номеру заявки; телефон — без форматирования.
  const digits = q.replace(/\D/g, "");
  const requests = all.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q ||
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)) ||
        `#${r.id}` === q ||
        String(r.id) === q),
  );
  const tabHref = (k: string) => `/admin/requests?${new URLSearchParams({ ...(k !== "all" ? { status: k } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div>
      <h1 className="text-2xl font-bold">Заявки клиентов</h1>
      <form action="/admin/requests" className="mt-5 flex max-w-xl gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Имя, почта, телефон или номер заявки"
          className="h-11 flex-1 rounded-xl border border-neutral-200 px-3.5 outline-none focus:border-brand-500"
        />
        <button className="h-11 rounded-xl bg-brand-600 px-5 font-medium text-white hover:bg-brand-700">Найти</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([k, title]) => (
          <Link
            key={k}
            href={tabHref(k)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm",
              status === k ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-200 hover:border-brand-400",
            )}
          >
            {title} <span className={status === k ? "text-white/70" : "text-neutral-400"}>{count(k)}</span>
          </Link>
        ))}
      </div>
      {requests.length === 0 ? (
        <p className="mt-6 text-neutral-500">{q || status !== "all" ? "Ничего не нашлось." : "Пока пусто — заявки из анкеты появятся здесь."}</p>
      ) : (
        <div className="mt-6 rounded-2xl border border-neutral-100">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead>Контакт</TableHead>
                <TableHead>Проблема</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className={r.crisisFlag ? "bg-red-50" : undefined}>
                  <TableCell>
                    <Link href={`/admin/requests/${r.id}`} className="font-medium text-brand-700 underline">
                      #{r.id}
                    </Link>
                    {r.crisisFlag && <span title="Кризисная анкета"> 🚨</span>}
                  </TableCell>
                  <TableCell className="text-neutral-500">{formatDbTime(r.createdAt)}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.email ?? r.phone ?? "—"}</TableCell>
                  <TableCell>{label(PROBLEM_LABELS, r.mainProblem)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[r.status] ?? "default"}>
                      {label(REQUEST_STATUS_LABELS, r.status)}
                    </Badge>
                    <SlaBadge status={r.status} createdAt={r.createdAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/**
 * Контроль SLA: клиенту обещан звонок в течение рабочего дня. Новая заявка
 * старше 8 часов — предупреждение, старше суток — просрочка.
 */
function SlaBadge({ status, createdAt }: { status: string; createdAt: string }) {
  if (status !== "new") return null;
  const hours = dbTimeAgeHours(createdAt);
  if (hours >= 24) {
    return (
      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        звонок просрочен · {Math.floor(hours)} ч
      </span>
    );
  }
  if (hours >= 8) {
    return (
      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        ждёт звонка {Math.floor(hours)} ч
      </span>
    );
  }
  return null;
}
