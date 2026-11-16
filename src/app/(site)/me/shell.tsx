import Link from "next/link";
import {
  IconCalendarEvent,
  IconCreditCard,
  IconHeadset,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconUserSearch,
} from "@tabler/icons-react";
import { ORG } from "@/lib/org";
import { cn } from "@/lib/utils";

export type CabinetSection = "home" | "podbor" | "vstrechi" | "oplaty" | "podderzhka";

export const SECTIONS: { key: CabinetSection; href: string; title: string; icon: typeof IconUserSearch }[] = [
  { key: "home", href: "/me", title: "Главная", icon: IconLayoutDashboard },
  { key: "podbor", href: "/me/podbor", title: "Подбор", icon: IconUserSearch },
  { key: "vstrechi", href: "/me/vstrechi", title: "Встречи", icon: IconCalendarEvent },
  { key: "oplaty", href: "/me/oplaty", title: "Оплаты", icon: IconCreditCard },
  { key: "podderzhka", href: "/me/podderzhka", title: "Поддержка", icon: IconHeadset },
];

/**
 * Каркас кабинета клиента в пяти вариантах (см. layout-config.ts). Содержимое
 * разделов одно и то же — меняется только навигация вокруг него.
 */
export function CabinetShell({
  layout = 1,
  active,
  badges = {},
  children,
}: {
  layout?: number;
  active: CabinetSection;
  badges?: Partial<Record<CabinetSection, number>>;
  children: React.ReactNode;
}) {
  if (layout === 2) return <SidebarShell active={active} badges={badges}>{children}</SidebarShell>;
  if (layout === 3) return <TilesShell active={active}>{children}</TilesShell>;
  if (layout === 4) return <OnePageShell badges={badges}>{children}</OnePageShell>;
  if (layout === 5) return <AppShell active={active} badges={badges}>{children}</AppShell>;
  return <TabsShell active={active} badges={badges}>{children}</TabsShell>;
}

type ShellProps = {
  active: CabinetSection;
  badges: Partial<Record<CabinetSection, number>>;
  children: React.ReactNode;
};

function Count({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "rounded-full bg-brand-600 px-1.5 text-xs font-medium leading-5 text-white",
        className,
      )}
    >
      {n}
    </span>
  );
}

/* 1. Вкладки над контентом */
function TabsShell({ active, badges, children }: ShellProps) {
  return (
    <div data-cabinet className="bg-white">
      <div data-cabinet-body>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <nav
          aria-label="Разделы кабинета"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-100 px-4"
        >
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              aria-current={s.key === active ? "page" : undefined}
              className={cn(
                "-mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
                s.key === active
                  ? "border-brand-600 font-medium text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-900",
              )}
            >
              <s.icon size={18} />
              {s.title}
              <Count n={badges[s.key]} />
            </Link>
          ))}
        </nav>
      </div>
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 pb-24">{children}</main>
      </div>
      <CabinetFooter />
    </div>
  );
}

/* 2. Боковое меню слева, на телефоне — строкой сверху */
function SidebarShell({ active, badges, children }: ShellProps) {
  return (
    <div data-cabinet className="bg-neutral-50">
      <div data-cabinet-body className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[230px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <div className="mb-3 hidden px-3 text-xs font-medium uppercase tracking-wide text-neutral-400 md:block">
            Мой кабинет
          </div>
          <nav aria-label="Разделы кабинета" className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                aria-current={s.key === active ? "page" : undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors",
                  s.key === active
                    ? "bg-white font-medium text-brand-700 shadow-sm ring-1 ring-neutral-200"
                    : "text-neutral-600 hover:bg-white",
                )}
              >
                <s.icon size={20} />
                <span className="flex-1">{s.title}</span>
                <Count n={badges[s.key]} />
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 space-y-10 rounded-3xl bg-white p-6 pb-24 shadow-sm ring-1 ring-neutral-200 sm:p-10">
          {children}
        </main>
      </div>
      <CabinetFooter />
    </div>
  );
}

/* 3. Плитки: меню нет, главная — сетка разделов, из раздела — назад к сетке */
function TilesShell({ active, children }: Omit<ShellProps, "badges">) {
  const section = SECTIONS.find((s) => s.key === active)!;
  return (
    <div data-cabinet className="bg-neutral-50">
      <main data-cabinet-body className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 pb-24">
        {active !== "home" && (
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/me"
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 py-2 font-medium text-neutral-700 shadow-sm ring-1 ring-neutral-200 hover:text-brand-700"
            >
              <IconLayoutGrid size={16} />
              Все разделы
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="flex items-center gap-1.5 text-neutral-500">
              <section.icon size={16} />
              {section.title}
            </span>
          </div>
        )}
        {active === "home" ? children : <div className="space-y-10 rounded-3xl bg-white p-6 sm:p-10">{children}</div>}
      </main>
      <CabinetFooter />
    </div>
  );
}

/* 4. Одна страница: все разделы подряд, слева — оглавление с якорями */
function OnePageShell({ badges, children }: Omit<ShellProps, "active">) {
  return (
    <div data-cabinet className="bg-white">
      <div data-cabinet-body className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="Разделы кабинета" className="sticky top-6 space-y-1 border-l border-neutral-200">
            {SECTIONS.map((s) => (
              <a
                key={s.key}
                href={`#${s.key}`}
                className="-ml-px flex cursor-pointer items-center gap-2 border-l-2 border-transparent py-1.5 pl-4 text-sm text-neutral-500 hover:border-brand-600 hover:text-neutral-900"
              >
                {s.title}
                <Count n={badges[s.key]} />
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 pb-24">{children}</main>
      </div>
      <CabinetFooter />
    </div>
  );
}

/* 5. Приложение: на компьютере — колонка иконок слева и контент на всю ширину,
   на телефоне — та же навигация нижней панелью. */
function AppShell({ active, badges, children }: ShellProps) {
  return (
    <div data-cabinet className="bg-neutral-50">
      <div data-cabinet-body className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-6 md:py-8">
        <nav
          aria-label="Разделы кабинета"
          className="sticky top-6 hidden flex-col gap-1 self-start rounded-3xl bg-white p-2 shadow-sm ring-1 ring-neutral-200 md:flex"
        >
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              aria-current={s.key === active ? "page" : undefined}
              className={cn(
                "relative flex w-20 cursor-pointer flex-col items-center gap-1 rounded-2xl py-3 text-[11px] transition-colors",
                s.key === active
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
              )}
            >
              <s.icon size={24} stroke={s.key === active ? 2 : 1.5} />
              {s.title}
              <Count n={badges[s.key]} className="absolute right-3 top-1.5 px-1 text-[10px] leading-4" />
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1 space-y-8 pb-40 md:pb-24">{children}</main>
      </div>
      <div className="hidden md:block">
        <CabinetFooter />
      </div>
      <nav
        aria-label="Разделы кабинета"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              aria-current={s.key === active ? "page" : undefined}
              className={cn(
                "relative flex cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                s.key === active ? "font-medium text-brand-700" : "text-neutral-500 hover:text-neutral-900",
              )}
            >
              <s.icon size={24} stroke={s.key === active ? 2 : 1.5} />
              {s.title}
              <Count n={badges[s.key]} className="absolute right-1/2 top-1 translate-x-5 px-1 text-[10px] leading-4" />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Счётчики меню из данных кабинета. */
export function cabinetBadges(c: {
  showProposals: boolean;
  chosen: unknown;
  upcoming: { paidAt: string | null }[];
  awaitingReview: unknown[];
}): Partial<Record<CabinetSection, number>> {
  const unpaid = c.upcoming.filter((s) => !s.paidAt).length;
  return {
    podbor: c.showProposals && !c.chosen ? 1 : undefined,
    vstrechi: c.awaitingReview.length || undefined,
    oplaty: unpaid || undefined,
  };
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{children}</h1>
      {sub && <p className="mt-2 text-neutral-600">{sub}</p>}
    </div>
  );
}

/** Что происходит с обращением, пока подборки ещё нет. */
export function waitingText(status: string): string {
  switch (status) {
    case "called":
      return "Мы уже пообщались и подбираем для вас психологов. Как только они появятся здесь — можно будет выбрать специалиста и время встречи.";
    case "rematch":
      return "Мы получили ваш запрос на другого специалиста и подбираем нового. Прежние записи отменены.";
    case "rejected":
      return "По вашей заявке мы больше не ведём подбор. Если запрос снова актуален — начните новый подбор, прежние ответы не пропадут.";
    default:
      return "Ваша анкета у оператора. Мы напишем вам в течение рабочего дня, чтобы уточнить детали и подобрать специалистов.";
  }
}

/**
 * Футер кабинета: большой футер сайта здесь только мешает, но политика ПД,
 * оферта и телефон должны оставаться под рукой. В «Приложении» на телефоне
 * его нет — внизу панель, ссылки живут в разделе «Поддержка».
 */
export function CabinetFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-neutral-400">
      <span>© {new Date().getFullYear()} {ORG.shortName}</span>
      <Link href="/privacy" className="cursor-pointer hover:text-neutral-700">
        Политика обработки данных
      </Link>
      <Link href="/oferta" className="cursor-pointer hover:text-neutral-700">
        Пользовательское соглашение
      </Link>
      <a href={`tel:${ORG.phone.replace(/[^+\d]/g, "")}`} className="cursor-pointer hover:text-neutral-700 sm:ml-auto">
        {ORG.phone}
      </a>
    </footer>
  );
}
