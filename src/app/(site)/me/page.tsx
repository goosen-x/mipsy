import Link from "next/link";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCreditCard,
  IconUserHeart,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { VariantSwitcher } from "@/components/variant-switcher";
import { formatSlot } from "@/lib/datetime";
import { label, REQUEST_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { canSwitchVariants, loadAccount, loadCabinet, type Cabinet } from "./data";
import { DEFAULT_EMPTY_VARIANT, EMPTY_VARIANTS, EmptyCabinet } from "./empty-variants";
import { CabinetShell, cabinetBadges, waitingText } from "./shell";

export const metadata = { title: "Личный кабинет — mipsy" };
export const dynamic = "force-dynamic";

/**
 * Главная кабинета клиента. Без анкеты — стартовый экран (варианты на выбор),
 * с анкетой — дашборд: следующий шаг и сводка по разделам. Сами подборка,
 * встречи, оплаты и поддержка живут в своих разделах (/me/podbor и т. д.).
 */
export default async function ClientCabinetPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { account, req } = await loadAccount("/me");

  // Аккаунт специалиста в клиентский кабинет не ходит. Исключение — заявки,
  // оставшиеся от времён, когда обе роли жили на одной почте: их не прячем,
  // иначе человек потеряет свои брони. Разносит такие пары админ.
  if (account.role === "psychologist" && !req) {
    return (
      <div className="bg-white">
        <main className="mx-auto max-w-3xl px-4 py-12">
          <section>
            <h1 className="text-2xl font-bold">Эта почта — кабинет специалиста</h1>
            <p className="mt-3 text-neutral-600">
              На {account.email} заведён кабинет психолога, а кабинет клиента живёт отдельно:
              так профиль, заявки и брони не перемешиваются. Если вы хотите обратиться к
              психологу для себя — войдите с другого адреса, это будет отдельный кабинет.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/cab"
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
              >
                Мой кабинет специалиста
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
              >
                Войти с другой почты
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!req) {
    const canSwitch = await canSwitchVariants();
    const asked = Number((await searchParams).v);
    const variant = canSwitch && asked >= 1 && asked <= 5 ? asked : DEFAULT_EMPTY_VARIANT;
    return (
      <div className="bg-white pb-20">
        <EmptyCabinet variant={variant} name={account.name} />
        {canSwitch && <VariantSwitcher current={variant} variants={EMPTY_VARIANTS} basePath="/me" />}
      </div>
    );
  }

  const c = await loadCabinet("/me");
  const step = nextStep(c);
  const next = c.upcoming[0];
  const unpaid = c.upcoming.filter((s) => !s.paidAt).length;

  return (
    <CabinetShell active="home" badges={cabinetBadges(c)}>
      {account.role === "psychologist" && (
        // Наследие: до разделения ролей обе жили на одной почте. Заявки не
        // прячем, но предупреждаем — новые заводятся только с другого адреса.
        <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
          На этой почте кабинет специалиста, а эти заявки остались от времени, когда роли
          жили на одном адресе. Они продолжают работать, но новую анкету отсюда не подать —
          для обращений как клиент заведите отдельный вход с другой почты. Если нужно
          разнести — напишите в <Link href="/me/podderzhka" className="underline">поддержку</Link>.
        </div>
      )}

      <section>
        <h1 className="text-3xl font-bold">Здравствуйте, {req.name}!</h1>
        <div className="mt-6 rounded-3xl bg-brand-50 p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-wide text-brand-700">Что дальше</div>
          <h2 className="mt-2 text-2xl font-bold">{step.title}</h2>
          <p className="mt-2 max-w-2xl text-neutral-700">{step.text}</p>
          {step.href && (
            <Button asChild size="lg" className="mt-5 rounded-xl">
              {step.external ? (
                <a href={step.href} target="_blank" rel="noreferrer">
                  {step.cta}
                </a>
              ) : (
                <Link href={step.href}>{step.cta}</Link>
              )}
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          href="/me/podbor"
          icon={IconUserHeart}
          title="Психолог"
          value={c.chosen ? c.chosen.psy.name : c.showProposals ? "Выберите из подборки" : "Ещё не выбран"}
        />
        <SummaryCard
          href="/me/vstrechi"
          icon={IconCalendarEvent}
          title="Ближайшая встреча"
          value={next ? formatSlot(next.startsAt) : "Не запланирована"}
        />
        <SummaryCard
          href="/me/oplaty"
          icon={IconCreditCard}
          title="Оплата"
          value={unpaid ? `К оплате: ${unpaid}` : "Долгов нет"}
          warn={unpaid > 0}
        />
      </section>

      {req.crisisFlag && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-900">
            Если станет совсем тяжело — не ждите звонка оператора:{" "}
            <Link href="/crisis" className="font-medium underline">
              телефоны круглосуточной поддержки
            </Link>
            .
          </p>
        </section>
      )}

      <p className="pb-4 text-center text-xs text-neutral-400">
        Вход в кабинет — по адресу {account.email} и коду из письма. Статус обращения:{" "}
        <Badge variant="secondary">{label(REQUEST_STATUS_LABELS, req.status)}</Badge>
      </p>
    </CabinetShell>
  );
}

function SummaryCard({
  href,
  icon: Icon,
  title,
  value,
  warn,
}: {
  href: string;
  icon: typeof IconUserHeart;
  title: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex cursor-pointer flex-col rounded-3xl border border-neutral-200 p-5 transition-colors hover:border-brand-300"
    >
      <Icon size={24} className="text-brand-600" />
      <div className="mt-4 text-sm text-neutral-500">{title}</div>
      <div className={warn ? "mt-1 font-semibold text-amber-800" : "mt-1 font-semibold"}>{value}</div>
      <IconArrowRight
        size={18}
        className="mt-3 text-neutral-400 transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}

type Step = { title: string; text: string; href?: string; cta?: string; external?: boolean };

/** Один главный шаг для клиента — по состоянию обращения, от срочного к фоновому. */
function nextStep(c: Cabinet): Step {
  const { req, chosen, showProposals, upcoming, calendarSlots, awaitingReview } = c;
  const next = upcoming[0];

  if (req.status === "rejected") {
    return { title: "Начните новый подбор", text: waitingText(req.status), href: "/anketa", cta: "Подобрать психолога" };
  }
  if (next && !next.paidAt) {
    return {
      title: `Встреча ${formatSlot(next.startsAt)}`,
      text: `С ${next.psyName}. Встреча ещё не оплачена — оплатить можно заранее.`,
      href: "/me/oplaty",
      cta: "Перейти к оплате",
    };
  }
  if (next) {
    return {
      title: `Встреча ${formatSlot(next.startsAt)}`,
      text: next.meetingLink
        ? `С ${next.psyName}. Ссылка откроет комнату встречи.`
        : `С ${next.psyName}. Ссылка на встречу появится здесь ближе ко времени.`,
      href: next.meetingLink ?? "/me/vstrechi",
      cta: next.meetingLink ? "Открыть встречу" : "Подробнее",
      external: Boolean(next.meetingLink),
    };
  }
  if (showProposals && !chosen) {
    return {
      title: "Выберите психолога",
      text: "Мы подобрали специалистов под ваш запрос. Посмотрите профили и выберите того, кто откликнется.",
      href: "/me/podbor",
      cta: "Смотреть подборку",
    };
  }
  if (chosen && req.status !== "rematch") {
    return {
      title: "Запишитесь на первую встречу",
      text:
        calendarSlots.length > 0
          ? `${chosen.psy.name} ждёт вас. Выберите удобное время.`
          : `Свободного времени у ${chosen.psy.name} пока нет — специалист скоро откроет расписание.`,
      href: "/me/vstrechi#booking",
      cta: "Выбрать время",
    };
  }
  if (awaitingReview.length > 0) {
    return {
      title: "Как прошла встреча?",
      text: "Оценка помогает другим людям выбрать специалиста.",
      href: "/me/vstrechi",
      cta: "Оставить отзыв",
    };
  }
  return { title: "Подбираем специалистов", text: waitingText(req.status) };
}
