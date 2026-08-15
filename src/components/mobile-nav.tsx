"use client";

import Link from "next/link";
import { useState } from "react";
import { IconMenu2, IconX } from "@tabler/icons-react";

const LINKS = [
  { href: "/catalog", label: "Психологи" },
  { href: "/psy", label: "Психологам" },
  { href: "/crisis", label: "Срочная помощь" },
];

/** Бургер-меню шапки для узких экранов; на sm+ скрыто, там обычная навигация. */
export function MobileNav({ cabinet }: { cabinet: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
      >
        {open ? <IconX size={22} /> : <IconMenu2 size={22} />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full z-20 border-b border-neutral-100 bg-white px-4 pb-4 shadow-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-neutral-100 py-3 text-neutral-700 hover:text-brand-700"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={cabinet ?? "/login"}
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-lg bg-brand-600 px-4 py-2.5 text-center font-medium text-white hover:bg-brand-700"
          >
            {cabinet ? "Мой кабинет" : "Войти"}
          </Link>
        </nav>
      )}
    </div>
  );
}
