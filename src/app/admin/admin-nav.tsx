"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAlertTriangle,
  IconBell,
  IconChartBar,
  IconCreditCard,
  IconHeadset,
  IconHistory,
  IconLayoutDashboard,
  IconStar,
  IconUserHeart,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { Wordmark } from "@/components/logo";
import type { AdminCounts } from "@/lib/admin-queue";
import { cn } from "@/lib/utils";

type Item = { href: string; title: string; icon: typeof IconUsers; badge?: number; alarm?: boolean };

/** Боковое меню админки: разделы и счётчики того, что ждёт действия. */
export function AdminNav({ counts, name, signOut }: { counts: AdminCounts; name: string; signOut: React.ReactNode }) {
  const pathname = usePathname();
  const groups: { title?: string; items: Item[] }[] = [
    {
      items: [{ href: "/admin", title: "Главная", icon: IconLayoutDashboard }],
    },
    {
      title: "Работа",
      items: [
        {
          href: "/admin/requests",
          title: "Клиенты",
          icon: IconUsers,
          badge: counts.requestsNew + counts.rematch,
          alarm: counts.crisis > 0 || counts.slaOverdue > 0,
        },
        { href: "/admin/psy", title: "Психологи", icon: IconUserHeart, badge: counts.psyModeration + counts.psyChanged },
        { href: "/admin/reviews", title: "Отзывы", icon: IconStar, badge: counts.reviewsPending },
        { href: "/admin/support", title: "Поддержка", icon: IconHeadset, badge: counts.ticketsOpen },
        { href: "/admin/payments", title: "Оплаты", icon: IconCreditCard },
      ],
    },
    {
      title: "Система",
      items: [
        { href: "/admin/notifications", title: "Уведомления", icon: IconBell, badge: counts.notificationsFailed, alarm: counts.notificationsFailed > 0 },
        { href: "/admin/stats", title: "Аналитика", icon: IconChartBar },
        { href: "/admin/errors", title: "Ошибки", icon: IconAlertTriangle, badge: counts.errorsUnseen },
        { href: "/admin/audit", title: "Журнал", icon: IconHistory },
        { href: "/admin/team", title: "Команда", icon: IconUsersGroup },
      ],
    },
  ];
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <aside className="border-b border-neutral-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-4 py-4 lg:px-5 lg:py-5">
        <Link href="/admin" className="flex items-center gap-2">
          <Wordmark className="h-5" />
          <span className="text-sm text-neutral-400">админ</span>
        </Link>
        <div className="lg:hidden">{signOut}</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className="flex gap-1 lg:flex-col">
            {g.title && (
              <div className="hidden px-2 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-400 lg:block">
                {g.title}
              </div>
            )}
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active(it.href) ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active(it.href) ? "bg-brand-50 font-medium text-brand-800" : "text-neutral-600 hover:bg-neutral-100",
                )}
              >
                <it.icon size={18} className={active(it.href) ? "text-brand-600" : "text-neutral-400"} />
                <span className="flex-1">{it.title}</span>
                {!!it.badge && (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold",
                      it.alarm ? "bg-red-500 text-white" : "bg-brand-100 text-brand-800",
                    )}
                  >
                    {it.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="hidden border-t border-neutral-100 p-3 lg:block">
        <div className="truncate px-3 pb-1 text-sm text-neutral-500">{name}</div>
        {signOut}
      </div>
    </aside>
  );
}
