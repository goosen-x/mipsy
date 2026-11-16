"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconLogout } from "@tabler/icons-react";
import { signOutAction } from "@/app/logout/actions";

/** «Мой кабинет» и меню аккаунта в шапке для вошедшего человека. */
export function AccountMenu({ cabinet, name, email }: { cabinet: string; name: string; email: string }) {
  const pathname = usePathname();
  const inCabinet = pathname.startsWith(cabinet);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-3">
      <Link
        href={cabinet}
        aria-current={inCabinet ? "page" : undefined}
        className={
          inCabinet
            ? "rounded-xl bg-brand-50 px-5 py-2.5 font-medium text-brand-800"
            : "rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
        }
      >
        Мой кабинет
      </Link>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-neutral-700 hover:bg-neutral-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <IconChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-neutral-100 bg-white p-2 shadow-lg"
          >
            <div className="px-3 py-2">
              <div className="truncate font-medium text-neutral-900">{name}</div>
              <div className="truncate text-sm text-neutral-500">{email}</div>
            </div>
            <div className="my-1 h-px bg-neutral-100" />
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-neutral-700 hover:bg-neutral-50"
              >
                <IconLogout size={18} /> Выйти
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
