import { loadCabinet } from "../data";
import { onePageRedirect, resolveLayout } from "../layout-config";
import { VstrechiBody } from "../sections";
import { CabinetShell, cabinetBadges } from "../shell";
import { CabinetSwitchers } from "../switchers";

export const metadata = { title: "Встречи — mipsy" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; layout?: string }>;
}) {
  const c = await loadCabinet("/me/vstrechi");
  const { layout, canSwitch } = await resolveLayout(searchParams);
  const sp = await searchParams;
  if (layout === 4) onePageRedirect("vstrechi", sp.v);

  return (
    <CabinetShell layout={layout} active="vstrechi" badges={cabinetBadges(c)}>
      <VstrechiBody c={c} />
      <CabinetSwitchers canSwitch={canSwitch} layout={layout} />
    </CabinetShell>
  );
}
