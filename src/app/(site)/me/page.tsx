import Link from "next/link";
import { VariantSwitcher } from "@/components/variant-switcher";
import { canSwitchVariants, loadAccount, loadCabinet } from "./data";
import { DEFAULT_EMPTY_VARIANT, EMPTY_VARIANTS, EmptyCabinet } from "./empty-variants";
import { resolveLayout } from "./layout-config";
import { HomeBody, OplatyBody, PodborBody, PodderzhkaBody, TilesHome, VstrechiBody } from "./sections";
import { CabinetFooter, CabinetShell, cabinetBadges, SECTIONS } from "./shell";
import { CabinetSwitchers, proposalVariant } from "./switchers";

export const metadata = { title: "Личный кабинет — mipsy" };
export const dynamic = "force-dynamic";

type SP = Promise<{ v?: string; layout?: string }>;

/**
 * Главная кабинета клиента. Без анкеты — стартовый экран (варианты на выбор).
 * С анкетой — главная в выбранном варианте кабинета: дашборд, плитки или,
 * в варианте «Одна страница», все разделы подряд.
 */
export default async function ClientCabinetPage({ searchParams }: { searchParams: SP }) {
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
      <div data-cabinet className="bg-white pb-20">
        <EmptyCabinet variant={variant} name={account.name} />
        <CabinetFooter />
        {canSwitch && <VariantSwitcher current={variant} variants={EMPTY_VARIANTS} basePath="/me" />}
      </div>
    );
  }

  const c = await loadCabinet("/me");
  const { layout, canSwitch } = await resolveLayout(searchParams);
  const sp = await searchParams;
  const badges = cabinetBadges(c);

  if (layout === 4) {
    const variant = proposalVariant(canSwitch, sp.v);
    const bodies = {
      home: <HomeBody c={c} />,
      podbor: <PodborBody c={c} variant={variant} />,
      vstrechi: <VstrechiBody c={c} />,
      oplaty: <OplatyBody c={c} />,
      podderzhka: <PodderzhkaBody c={c} />,
    };
    return (
      <CabinetShell layout={4} active="home" badges={badges}>
        {SECTIONS.map((s, i) => (
          <section
            key={s.key}
            id={s.key}
            className={i === 0 ? "scroll-mt-6 space-y-10" : "scroll-mt-6 space-y-10 border-t border-neutral-100 pt-12 mt-12"}
          >
            {bodies[s.key]}
          </section>
        ))}
        <CabinetSwitchers
          canSwitch={canSwitch}
          layout={layout}
          proposals={c.showProposals ? { variant, basePath: "/me" } : undefined}
        />
      </CabinetShell>
    );
  }

  return (
    <CabinetShell layout={layout} active="home" badges={badges}>
      {layout === 3 ? <TilesHome c={c} /> : <HomeBody c={c} />}
      <CabinetSwitchers canSwitch={canSwitch} layout={layout} />
    </CabinetShell>
  );
}
