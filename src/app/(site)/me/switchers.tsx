import { VariantSwitcher } from "@/components/variant-switcher";
import { DemoBar } from "./demo-bar";
import { DEMO_STATES, readDemoState } from "./demo";
import { LAYOUT_COOKIE, LAYOUT_VARIANTS } from "./layout-config";
import { LayoutSwitcher } from "./layout-switcher";
import { DEFAULT_PROPOSAL_VARIANT, PROPOSAL_VARIANTS } from "./proposals-config";

/** Вариант подборки из `?v=` — только тем, кто видит переключатели. */
export function proposalVariant(canSwitch: boolean, v: string | undefined): number {
  const asked = Number(v);
  return canSwitch && asked >= 1 && asked <= 5 ? asked : DEFAULT_PROPOSAL_VARIANT;
}

/**
 * Плашки выбора внизу экрана, одним блоком колонкой: вариант экрана (подборки
 * или стартового), вариант кабинета и — в демо — состояние клиента со ссылкой.
 * Высота одна для всех вариантов — над нижней панелью «Приложения» и над
 * футером кабинета, — чтобы при переключении блок не прыгал.
 */
export async function CabinetSwitchers({
  canSwitch,
  layout,
  screen,
}: {
  canSwitch: boolean;
  /** Нет у стартового экрана — там каркаса кабинета ещё нет. */
  layout?: number;
  screen?: {
    title: string;
    variants: readonly { n: number; label: string }[];
    current: number;
    basePath: string;
  };
}) {
  if (!canSwitch) return null;
  const demo = await readDemoState();
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-col items-center gap-2">
      {screen && (
        <VariantSwitcher
          inline
          title={screen.title}
          current={screen.current}
          variants={screen.variants}
          basePath={screen.basePath}
        />
      )}
      {layout && <LayoutSwitcher current={layout} variants={LAYOUT_VARIANTS} cookie={LAYOUT_COOKIE} />}
      {demo && <DemoBar state={demo} states={DEMO_STATES} layout={layout ?? 1} />}
    </div>
  );
}

export function proposalsScreen(variant: number, basePath: string) {
  return { title: "Подборка", variants: PROPOSAL_VARIANTS, current: variant, basePath };
}
