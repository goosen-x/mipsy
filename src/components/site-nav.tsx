"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_SECTIONS } from "./site-sections";

/** Разделы в шапке — настоящие страницы; текущая подсвечена. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-6 text-sm lg:flex">
      {SITE_SECTIONS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={active ? "font-medium text-brand-700" : "text-neutral-600 hover:text-brand-700"}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
