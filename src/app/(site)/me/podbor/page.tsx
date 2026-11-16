import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VariantSwitcher } from "@/components/variant-switcher";
import { gradePriceLabel } from "@/lib/grades";
import { label, REQUEST_STATUS_LABELS } from "@/lib/labels";
import { RematchControl } from "../controls";
import { canSwitchVariants, loadCabinet } from "../data";
import { DEFAULT_PROPOSAL_VARIANT, PROPOSAL_VARIANTS } from "../proposals-config";
import { ProposalsView } from "../proposals-variants";
import { CabinetShell, cabinetBadges, SectionTitle, waitingText } from "../shell";

export const metadata = { title: "Подбор психолога — mipsy" };
export const dynamic = "force-dynamic";

export default async function PodborPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const c = await loadCabinet("/me/podbor");
  const { req, proposals, chosen, showProposals } = c;
  const canSwitch = await canSwitchVariants();
  const asked = Number((await searchParams).v);
  const variant = canSwitch && asked >= 1 && asked <= 5 ? asked : DEFAULT_PROPOSAL_VARIANT;

  return (
    <CabinetShell active="podbor" badges={cabinetBadges(c)}>
      {showProposals ? (
        <section>
          <SectionTitle
            sub={
              chosen
                ? "Пока вы не записались, выбор можно поменять — список никуда не денется."
                : "Посмотрите профили и выберите того, кто откликнется. Если не подойдёт — бесплатно подберём другого."
            }
          >
            Мы подобрали для вас{" "}
            {proposals.length === 1 ? "специалиста" : `${proposals.length} специалистов`}
          </SectionTitle>
          {chosen && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4">
              <p className="flex-1 text-sm text-brand-900">
                Вы выбрали: <span className="font-medium">{chosen.psy.name}</span>. Осталось
                выбрать время первой встречи.
              </p>
              <Button asChild className="rounded-lg">
                <Link href="/me/vstrechi#booking">Выбрать время</Link>
              </Button>
            </div>
          )}
          <div className="mt-6">
            <ProposalsView variant={variant} anyChosen={Boolean(chosen)} proposals={proposals} />
          </div>
        </section>
      ) : chosen ? (
        <section>
          <SectionTitle>Ваш психолог</SectionTitle>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {chosen.psy.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={chosen.psy.photoUrl}
                alt={chosen.psy.name}
                className="h-20 w-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700">
                {chosen.psy.name.slice(0, 1)}
              </div>
            )}
            <div className="flex-1">
              <div className="text-xl font-semibold">{chosen.psy.name}</div>
              <div className="text-neutral-500">{chosen.psy.approach}</div>
              <div className="mt-1 text-sm text-neutral-600">
                {gradePriceLabel(chosen.psy.grade) ?? "стоимость уточняется"}
              </div>
              {chosen.psy.slug && (
                <Link
                  href={`/psihologi/${chosen.psy.slug}`}
                  className="mt-1 inline-block text-sm text-brand-700 underline"
                >
                  Открыть профиль
                </Link>
              )}
            </div>
          </div>
          {proposals.length > 1 && (
            <p className="mt-3 text-xs text-neutral-500">
              Вы выбрали из {proposals.length} предложенных. Передумали? Попросите другого
              специалиста ниже.
            </p>
          )}
        </section>
      ) : (
        <section>
          <SectionTitle sub={waitingText(req.status)}>Подбор психолога</SectionTitle>
          {req.status === "rejected" && (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="rounded-lg">
                <Link href="/anketa">Подобрать психолога</Link>
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Второй путь — выбрать самому. Равноправный с подборкой, а не мелкая сноска. */}
      {!chosen || showProposals ? (
        <section className="flex flex-col gap-6 rounded-3xl border border-neutral-200 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IconSearch size={28} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Хотите выбрать сами?</h2>
            <p className="mt-1 text-neutral-600">
              Откройте каталог всех проверенных психологов. Фильтры по вашим ответам из анкеты уже
              включены — их можно поменять. Записаться можно к любому специалисту.
            </p>
          </div>
          <Button asChild size="lg" variant="outline" className="shrink-0">
            <Link href={c.catalogUrl}>Открыть каталог</Link>
          </Button>
        </section>
      ) : null}

      {chosen && req.status !== "rematch" && (
        <section id="rematch" className="border-t border-neutral-100 pt-8">
          <h2 className="text-lg font-bold">Психолог не подошёл?</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Это нормально и случается часто — совпасть с первого раза удаётся не всем. Мы
            бесплатно подберём другого специалиста.
          </p>
          <div className="mt-4">
            <RematchControl />
          </div>
        </section>
      )}

      {c.myRequests.length > 1 && (
        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-lg font-bold">Прошлые обращения</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600">
            {c.myRequests.slice(1).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span>{r.createdAt.slice(0, 10)}</span>
                <Badge variant="secondary">{label(REQUEST_STATUS_LABELS, r.status)}</Badge>
                {r.mainProblem && <span className="text-neutral-500">{r.mainProblem}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-400">
            Встречи по прошлым обращениям — в разделе «Встречи».
          </p>
        </section>
      )}

      {canSwitch && showProposals && (
        <VariantSwitcher current={variant} variants={PROPOSAL_VARIANTS} basePath="/me/podbor" />
      )}
    </CabinetShell>
  );
}
