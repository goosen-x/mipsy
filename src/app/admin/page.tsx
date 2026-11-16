import { desc } from "drizzle-orm";
import { clientRequests, db, psychologists } from "@/db";
import { loadAdminCounts, loadAttention, loadWeekStats } from "@/lib/admin-queue";
import { cookies } from "next/headers";
import { ViewTabs } from "./view-tabs";
import { requireAdmin } from "./require-admin";
import { DashboardHome, InboxHome, PipelineHome } from "./home-variants";

// Главный экран админки в трёх видах: дашборд, входящие, воронка (?v=1…3).
// Последний выбранный вид запоминается в куке admin_view. Список заявок —
// в /admin/requests.
const DEFAULT_HOME_VARIANT = 1;

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; f?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const v = Number(sp.v ?? (await cookies()).get("admin_view")?.value);
  const variant = v >= 1 && v <= 3 ? v : DEFAULT_HOME_VARIANT;

  let body: React.ReactNode;
  if (variant === 2) {
    body = <InboxHome attention={await loadAttention()} filter={sp.f ?? "all"} />;
  } else if (variant === 3) {
    const requests = await db
      .select({
        id: clientRequests.id,
        name: clientRequests.name,
        status: clientRequests.status,
        createdAt: clientRequests.createdAt,
        mainProblem: clientRequests.mainProblem,
        crisisFlag: clientRequests.crisisFlag,
      })
      .from(clientRequests)
      .orderBy(desc(clientRequests.createdAt));
    const psys = await db
      .select({
        id: psychologists.id,
        name: psychologists.name,
        moderationStatus: psychologists.moderationStatus,
        needsReview: psychologists.needsReview,
        createdAt: psychologists.createdAt,
      })
      .from(psychologists)
      .orderBy(desc(psychologists.createdAt));
    body = <PipelineHome requests={requests} psys={psys} />;
  } else {
    const recent = await db
      .select({
        id: clientRequests.id,
        name: clientRequests.name,
        status: clientRequests.status,
        createdAt: clientRequests.createdAt,
        mainProblem: clientRequests.mainProblem,
        crisisFlag: clientRequests.crisisFlag,
      })
      .from(clientRequests)
      .orderBy(desc(clientRequests.createdAt))
      .limit(6);
    body = (
      <DashboardHome
        counts={await loadAdminCounts()}
        attention={await loadAttention()}
        week={await loadWeekStats()}
        recent={recent}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <ViewTabs current={variant} />
      </div>
      {body}
    </div>
  );
}
