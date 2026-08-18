import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { label, MODERATION_STATUS_LABELS } from "@/lib/labels";
import { requireAdmin } from "../require-admin";
import { formatDbTime } from "@/lib/datetime";

const TONE: Record<string, "default" | "secondary" | "destructive"> = {
  new: "default",
  approved: "secondary",
  rejected: "destructive",
};

export default async function OpPsyListPage() {
  await requireAdmin();

  const list = await db.select().from(psychologists).orderBy(desc(psychologists.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold">Заявки психологов</h1>
      {list.length === 0 ? (
        <p className="mt-4 text-neutral-500">Пока пусто — заявки со страницы «Психологам» появятся здесь.</p>
      ) : (
        <div className="mt-6 rounded-2xl border border-neutral-100">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Опыт</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/admin/psy/${p.id}`} className="font-medium text-brand-700 underline">
                      #{p.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-neutral-500">{formatDbTime(p.createdAt)}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell>{p.experienceYears != null ? `${p.experienceYears} лет` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={TONE[p.moderationStatus] ?? "default"}>
                      {label(MODERATION_STATUS_LABELS, p.moderationStatus)}
                    </Badge>
                    {p.needsReview && (
                      <Badge variant="outline" className="ml-2">
                        профиль изменён
                      </Badge>
                    )}
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
