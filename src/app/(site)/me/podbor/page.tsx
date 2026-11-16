import { loadCabinet } from "../data";
import { onePageRedirect, resolveLayout } from "../layout-config";
import { PodborBody } from "../sections";
import { CabinetShell, cabinetBadges } from "../shell";
import { CabinetSwitchers, proposalsScreen, proposalVariant } from "../switchers";

export const metadata = { title: "Подбор психолога — mipsy" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; layout?: string }>;
}) {
  const c = await loadCabinet("/me/podbor");
  const { layout, canSwitch } = await resolveLayout(searchParams);
  const sp = await searchParams;
  if (layout === 4) onePageRedirect("podbor", sp.v);
  const variant = proposalVariant(canSwitch, sp.v);

  return (
    <CabinetShell layout={layout} active="podbor" badges={cabinetBadges(c)}>
      <PodborBody c={c} variant={variant} />
      <CabinetSwitchers canSwitch={canSwitch} layout={layout}
        screen={c.showProposals ? proposalsScreen(variant, "/me/podbor") : undefined}
       />
    </CabinetShell>
  );
}
