"use client";

import Link from "next/link";
import { useState } from "react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { signOutAction } from "@/app/logout/actions";
import { SITE_SECTIONS } from "./site-sections";

const LINKS = [
  ...SITE_SECTIONS,
  { href: "/psihologi", label: "Психологи" },
  { href: "/psihologam", label: "Я психолог" },
  { href: "/crisis", label: "Срочная помощь" },
];

/** Бургер-меню шапки для узких экранов; на sm+ скрыто, там обычная навигация. */
export function MobileNav({ cabinet, signedIn }: { cabinet: string | null; signedIn: boolean }) {
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
            href={cabinet ?? "/login?next=%2Fanketa"}
            onClick={() => setOpen(false)}
            className="mt-4 block rounded-xl bg-brand-600 px-4 py-2.5 text-center font-medium text-white hover:bg-brand-700"
          >
            {cabinet ? "Мой кабинет" : "Подобрать психолога"}
          </Link>
          {signedIn && (
            <form action={signOutAction}>
              <button
                type="submit"
                className="mt-2 block w-full cursor-pointer py-2 text-center text-neutral-600 hover:text-brand-700"
              >
                Выйти
              </button>
            </form>
          )}
          {!cabinet && (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 block py-2 text-center text-neutral-600 hover:text-brand-700"
            >
              Войти
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
