"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Переключатель вариантов кабинета. Пишет выбор в куку (вариант держится при
 * переходах между разделами) и в `?layout=` — чтобы страница сразу
 * отрисовалась в новом виде.
 */
export function LayoutSwitcher({
  current,
  variants,
  cookie,
  lifted,
}: {
  current: number;
  variants: readonly { n: number; label: string }[];
  cookie: string;
  /** Поднять над нижней панелью варианта «Приложение». */
  lifted?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Варианты кабинета"
      className={cn(
        "fixed inset-x-0 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-1 overflow-x-auto rounded-2xl bg-brand-900/95 p-1.5 text-sm text-white shadow-lg backdrop-blur",
        lifted ? "bottom-24" : "bottom-4",
      )}
    >
      <span className="px-2 text-white/60">Кабинет</span>
      {variants.map((v) => (
        <Link
          key={v.n}
          href={`${pathname}?layout=${v.n}`}
          scroll={false}
          onClick={() => {
            document.cookie = `${cookie}=${v.n}; path=/me; max-age=31536000; samesite=lax`;
          }}
          className={cn(
            "cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 transition-colors",
            v.n === current ? "bg-white font-medium text-neutral-900" : "hover:bg-white/15",
          )}
        >
          {v.n} · {v.label}
        </Link>
      ))}
    </nav>
  );
}
