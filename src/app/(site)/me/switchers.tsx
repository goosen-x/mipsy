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
  const app = layout === 5;
  return (
    <>
      <LayoutSwitcher current={layout} variants={LAYOUT_VARIANTS} cookie={LAYOUT_COOKIE} lifted={app} />
      {proposals && (
        <VariantSwitcher
          title="Подборка"
          current={proposals.variant}
          variants={PROPOSAL_VARIANTS}
          basePath={proposals.basePath}
          positionClass={app ? "bottom-36" : "bottom-16"}
        />
      )}
    </>
  );
}
