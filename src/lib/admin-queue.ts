import "server-only";
import { and, desc, eq, gte, isNotNull, ne, or, sql } from "drizzle-orm";
import {
  clientRequests,
  db,
  errorLog,
  notifications,
  payments,
  psychologists,
  reviews,
  slots,
  supportTickets,
} from "@/db";
import { dbTimeAgeHours, nowMsk } from "@/lib/datetime";
import { nowDbTime } from "@/lib/auth-core";
import { label, PROBLEM_LABELS } from "@/lib/labels";

/**
 * Всё, что в админке ждёт действия: счётчики для бокового меню и единая
 * очередь дел для главного экрана. Один источник — чтобы цифры в меню,
 * на дашборде и во «входящих» не расходились.
 */

export type AdminCounts = {
  requestsNew: number;
  crisis: number;
  slaOverdue: number;
  rematch: number;
  psyModeration: number;
  psyChanged: number;
  reviewsPending: number;
  ticketsOpen: number;
  notificationsFailed: number;
  errorsUnseen: number;
};

export type AttentionKind = "crisis" | "rematch" | "request" | "psy" | "psy-changed" | "review" | "ticket" | "system";

export type AttentionItem = {
  kind: AttentionKind;
  /** 0 — горит, 1 — сегодня, 2 — в рабочем порядке. */
  urgency: 0 | 1 | 2;
  title: string;
  subtitle: string;
  href: string;
  /** Время события в формате БД — для «3 ч назад» и сортировки. */
  at: string;
};

export async function loadAdminCounts(): Promise<AdminCounts> {
  const newRequests = await db
    .select({ createdAt: clientRequests.createdAt, crisis: clientRequests.crisisFlag })
    .from(clientRequests)
    .where(eq(clientRequests.status, "new"));
  const count = async (q: Promise<{ c: number }[]>) => (await q)[0]?.c ?? 0;
  const c = sql<number>`count(*)`;

  return {
    requestsNew: newRequests.length,
    crisis: newRequests.filter((r) => r.crisis).length,
    slaOverdue: newRequests.filter((r) => dbTimeAgeHours(r.createdAt) >= 24).length,
    rematch: await count(db.select({ c }).from(clientRequests).where(eq(clientRequests.status, "rematch"))),
    psyModeration: await count(db.select({ c }).from(psychologists).where(eq(psychologists.moderationStatus, "new"))),
    psyChanged: await count(db.select({ c }).from(psychologists).where(eq(psychologists.needsReview, true))),
    reviewsPending: await count(db.select({ c }).from(reviews).where(eq(reviews.status, "pending"))),
    ticketsOpen: await count(db.select({ c }).from(supportTickets).where(ne(supportTickets.status, "closed"))),
    notificationsFailed: await count(
      db
        .select({ c })
        .from(notifications)
        .where(and(eq(notifications.status, "pending"), isNotNull(notifications.error))),
    ),
    errorsUnseen: await count(db.select({ c }).from(errorLog).where(eq(errorLog.seen, false))),
  };
}

const ageLabel = (at: string) => {
  const h = dbTimeAgeHours(at);
  if (h < 1) return "только что";
  if (h < 24) return `${Math.floor(h)} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
};

export async function loadAttention(): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  const requests = await db
    .select()
    .from(clientRequests)
    .where(or(eq(clientRequests.status, "new"), eq(clientRequests.status, "rematch")))
    .orderBy(desc(clientRequests.createdAt));
  for (const r of requests) {
    const hours = dbTimeAgeHours(r.createdAt);
    if (r.status === "rematch") {
      items.push({
        kind: "rematch",
        urgency: 1,
        title: `${r.name} просит другого психолога`,
        subtitle: r.rematchReason ? `Причина: ${r.rematchReason}` : "Причина не указана",
        href: `/admin/requests/${r.id}`,
        at: r.createdAt,
      });
    } else {
      items.push({
        kind: r.crisisFlag ? "crisis" : "request",
        urgency: r.crisisFlag || hours >= 24 ? 0 : hours >= 8 ? 1 : 2,
        title: r.crisisFlag ? `Кризисная анкета: ${r.name}` : `Новая заявка: ${r.name}`,
        subtitle: [
          r.mainProblem ? label(PROBLEM_LABELS, r.mainProblem) : null,
          hours >= 24
            ? `звонок просрочен на ${hours >= 48 ? `${Math.floor(hours / 24)} дн` : `${Math.floor(hours)} ч`}`
            : `ждёт звонка ${ageLabel(r.createdAt).replace(" назад", "")}`,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/admin/requests/${r.id}`,
        at: r.createdAt,
      });
    }
  }

  const psys = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      status: psychologists.moderationStatus,
      needsReview: psychologists.needsReview,
      createdAt: psychologists.createdAt,
    })
    .from(psychologists)
    .where(or(eq(psychologists.moderationStatus, "new"), eq(psychologists.needsReview, true)));
  for (const p of psys) {
    items.push(
      p.status === "new"
        ? {
            kind: "psy",
            urgency: 2,
            title: `Заявка психолога: ${p.name}`,
            subtitle: "Проверить образование и документы",
            href: `/admin/psy/${p.id}`,
            at: p.createdAt,
          }
        : {
            kind: "psy-changed",
            urgency: 2,
            title: `${p.name} изменил профиль`,
            subtitle: "Профиль опубликован — вычитать правки",
            href: `/admin/psy/${p.id}`,
            at: p.createdAt,
          },
    );
  }

  const pendingReviews = await db
    .select({ id: reviews.id, rating: reviews.rating, author: reviews.authorName, createdAt: reviews.createdAt })
    .from(reviews)
    .where(eq(reviews.status, "pending"));
  for (const r of pendingReviews) {
    items.push({
      kind: "review",
      urgency: 2,
      title: `Отзыв ${"★".repeat(r.rating)} от ${r.author}`,
      subtitle: "Ждёт модерации перед публикацией",
      href: "/admin/reviews",
      at: r.createdAt,
    });
  }

  const tickets = await db
    .select({
      id: supportTickets.id,
      kind: supportTickets.kind,
      name: supportTickets.name,
      body: supportTickets.body,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(ne(supportTickets.status, "closed"));
  for (const t of tickets) {
    const complaint = t.kind === "complaint";
    items.push({
      kind: "ticket",
      urgency: complaint ? 0 : t.status === "new" ? 1 : 2,
      title: `${complaint ? "Жалоба" : "Вопрос"} от ${t.name ?? "пользователя"}`,
      subtitle: t.body.slice(0, 90),
      href: "/admin/support",
      at: t.createdAt,
    });
  }

  const counts = await loadAdminCounts();
  if (counts.notificationsFailed) {
    items.push({
      kind: "system",
      urgency: 1,
      title: `Не ушло уведомлений: ${counts.notificationsFailed}`,
      subtitle: "Письма или SMS с ошибкой — отправить вручную",
      href: "/admin/notifications",
      at: nowDbTime(),
    });
  }
  if (counts.errorsUnseen) {
    items.push({
      kind: "system",
      urgency: 2,
      title: `Новых ошибок на сайте: ${counts.errorsUnseen}`,
      subtitle: "Посмотреть журнал ошибок",
      href: "/admin/errors",
      at: nowDbTime(),
    });
  }

  return items.sort((a, b) => a.urgency - b.urgency || b.at.localeCompare(a.at));
}

/** Цифры за последние 7 дней для дашборда. */
export async function loadWeekStats(): Promise<{
  requests: number;
  sessions: number;
  paid: number;
  activePsy: number;
}> {
  const weekAgo = nowDbTime(new Date(Date.now() - 7 * 86400000));
  const weekAgoMsk = nowMsk(new Date(Date.now() - 7 * 86400000));
  const now = nowMsk();
  const c = sql<number>`count(*)`;
  const [req] = await db.select({ c }).from(clientRequests).where(gte(clientRequests.createdAt, weekAgo));
  const sessionRows = await db
    .select({ startsAt: slots.startsAt })
    .from(slots)
    .where(or(eq(slots.status, "booked"), eq(slots.status, "done")));
  const [paid] = await db
    .select({ s: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.status, "succeeded"), gte(payments.createdAt, weekAgo)));
  const [psy] = await db
    .select({ c })
    .from(psychologists)
    .where(and(eq(psychologists.moderationStatus, "approved"), eq(psychologists.hidden, false)));
  return {
    requests: req?.c ?? 0,
    sessions: sessionRows.filter((s) => s.startsAt >= weekAgoMsk && s.startsAt <= now).length,
    paid: paid?.s ?? 0,
    activePsy: psy?.c ?? 0,
  };
}

export { ageLabel };
