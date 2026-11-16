"use client";

import Link from "next/link";
import { IconColumns3, IconInbox, IconLayoutDashboard } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { n: 1, label: "Дашборд", icon: IconLayoutDashboard },
  { n: 2, label: "Входящие", icon: IconInbox },
  { n: 3, label: "Воронка", icon: IconColumns3 },
] as const;

/** Вид главного экрана админки. Выбор запоминается в куке — открывается в следующий раз. */
export function ViewTabs({ current }: { current: number }) {
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-neutral-200">
      {VIEWS.map((v) => (
        <Link
          key={v.n}
          href={`/admin?v=${v.n}`}
          role="tab"
          aria-selected={v.n === current}
          scroll={false}
          onClick={() => {
            document.cookie = `admin_view=${v.n}; path=/admin; max-age=31536000; samesite=lax`;
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors",
            v.n === current ? "bg-brand-600 font-medium text-white" : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          <v.icon size={18} />
          {v.label}
        </Link>
      ))}
    </div>
  );
}
