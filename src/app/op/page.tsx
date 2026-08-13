import Link from "next/link";
import { desc } from "drizzle-orm";
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

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  called: "secondary",
  matched: "outline",
  rejected: "destructive",
};

export default async function OpRequestsPage() {
  const requests = await db.select().from(clientRequests).orderBy(desc(clientRequests.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold">Заявки клиентов</h1>
      {requests.length === 0 ? (
        <p className="mt-4 text-neutral-500">Пока пусто — заявки из анкеты появятся здесь.</p>
      ) : (
        <div className="mt-6 rounded-2xl bg-white shadow-sm">
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
                    <Link href={`/op/requests/${r.id}`} className="font-medium text-brand-700 underline">
                      #{r.id}
                    </Link>
                    {r.crisisFlag && <span title="Кризисная анкета"> 🚨</span>}
                  </TableCell>
                  <TableCell className="text-neutral-500">{r.createdAt.slice(0, 16)}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.email ?? r.phone ?? "—"}</TableCell>
                  <TableCell>{label(PROBLEM_LABELS, r.mainProblem)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_TONE[r.status] ?? "default"}>
                      {label(REQUEST_STATUS_LABELS, r.status)}
                    </Badge>
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
