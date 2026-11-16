"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Плашка демо: состояние клиента, ссылка на текущий экран и выход. Ссылка
 * собирает всё, что сейчас выбрано: состояние, вариант кабинета и подборки, —
 * её можно сразу отправить.
 */
export function DemoBar({
  state,
  states,
  layout,
}: {
  state: string;
  states: readonly { key: string; label: string }[];
  layout: number;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [copied, setCopied] = useState(false);

  const linkFor = (s: string) => {
    const q = new URLSearchParams({ state: s, layout: String(layout) });
    const v = sp.get("v");
    if (v && s === state) q.set("v", v);
    return `/demo?${q}`;
  };

  const copy = async () => {
    const url = new URL(linkFor(state), window.location.origin);
    // Ссылка ведёт в тот же раздел кабинета, который открыт сейчас.
    if (pathname !== "/me") url.searchParams.set("to", pathname);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <nav
      aria-label="Демо: состояние клиента"
      className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 text-sm text-neutral-700 shadow-lg ring-1 ring-neutral-200"
    >
      <span className="px-2 whitespace-nowrap text-neutral-400">Клиент</span>
      {states.map((s) => (
        <a
          key={s.key}
          href={linkFor(s.key)}
          className={cn(
            "cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 transition-colors",
            s.key === state ? "bg-brand-600 font-medium text-white" : "hover:bg-neutral-100",
          )}
        >
          {s.label}
        </a>
      ))}
      <span className="mx-1 h-5 w-px shrink-0 bg-neutral-200" />
      <button
        type="button"
        onClick={copy}
        className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 hover:bg-neutral-100"
      >
        {copied ? <IconCheck size={16} className="text-brand-600" /> : <IconCopy size={16} />}
        {copied ? "Скопировано" : "Ссылка"}
      </button>
      <a
        href="/demo?state=off"
        title="Выйти из демо"
        className="flex cursor-pointer items-center rounded-xl px-2 py-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <IconX size={16} />
      </a>
    </nav>
  );
}
