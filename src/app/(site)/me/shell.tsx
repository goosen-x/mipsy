import Link from "next/link";
import {
  IconCalendarEvent,
  IconCreditCard,
  IconHeadset,
  IconLayoutDashboard,
  IconUserSearch,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type CabinetSection = "home" | "podbor" | "vstrechi" | "oplaty" | "podderzhka";

const SECTIONS: { key: CabinetSection; href: string; title: string; icon: typeof IconUserSearch }[] = [
  { key: "home", href: "/me", title: "Главная", icon: IconLayoutDashboard },
  { key: "podbor", href: "/me/podbor", title: "Подбор", icon: IconUserSearch },
  { key: "vstrechi", href: "/me/vstrechi", title: "Встречи", icon: IconCalendarEvent },
  { key: "oplaty", href: "/me/oplaty", title: "Оплаты", icon: IconCreditCard },
  { key: "podderzhka", href: "/me/podderzhka", title: "Поддержка", icon: IconHeadset },
];

/**
 * Каркас кабинета клиента: меню разделов и колонка контента. Счётчики в меню —
 * что ждёт действия клиента в разделе (выбрать специалиста, оплатить и т. п.).
 */
export function CabinetShell({
  active,
  badges = {},
  children,
}: {
  active: CabinetSection;
  badges?: Partial<Record<CabinetSection, number>>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <nav
          aria-label="Разделы кабинета"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-100 px-4"
        >
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            const badge = badges[s.key];
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
                  isActive
                    ? "border-brand-600 font-medium text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-900",
                )}
              >
                <s.icon size={18} />
                {s.title}
                {badge ? (
                  <span className="rounded-full bg-brand-600 px-1.5 text-xs font-medium leading-5 text-white">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 pb-24">{children}</main>
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
