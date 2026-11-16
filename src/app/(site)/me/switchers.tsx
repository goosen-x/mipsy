import { VariantSwitcher } from "@/components/variant-switcher";
import { LAYOUT_COOKIE, LAYOUT_VARIANTS } from "./layout-config";
import { LayoutSwitcher } from "./layout-switcher";
import { DEFAULT_PROPOSAL_VARIANT, PROPOSAL_VARIANTS } from "./proposals-config";

/** Вариант подборки из `?v=` — только тем, кто видит переключатели. */
export function proposalVariant(canSwitch: boolean, v: string | undefined): number {
  const asked = Number(v);
  return canSwitch && asked >= 1 && asked <= 5 ? asked : DEFAULT_PROPOSAL_VARIANT;
}

/**
 * Плашки выбора внизу экрана: вариант кабинета и, где есть подборка, её вариант
 * — второй плашкой над первой. В варианте «Приложение» обе поднимаются над
 * нижней панелью.
 */
export function CabinetSwitchers({
  canSwitch,
  layout,
  proposals,
}: {
  canSwitch: boolean;
  layout: number;
  proposals?: { variant: number; basePath: string };
}) {
  if (!canSwitch) return null;
  // Один закреплённый блок: плашки стоят колонкой и не наезжают друг на друга.
  // Высота одна для всех вариантов — над нижней панелью «Приложения» и над
  // футером кабинета, — чтобы при переключении плашка не прыгала.
  return (
    <div
      className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-col items-center gap-2"
    >
      {proposals && (
        <VariantSwitcher
          inline
          title="Подборка"
          current={proposals.variant}
          variants={PROPOSAL_VARIANTS}
          basePath={proposals.basePath}
        />
      )}
      <LayoutSwitcher current={layout} variants={LAYOUT_VARIANTS} cookie={LAYOUT_COOKIE} />
    </div>
  );
}
