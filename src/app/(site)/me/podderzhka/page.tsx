import { loadCabinet } from "../data";
import { onePageRedirect, resolveLayout } from "../layout-config";
import { PodderzhkaBody } from "../sections";
import { CabinetShell, cabinetBadges } from "../shell";
import { CabinetSwitchers } from "../switchers";

export const metadata = { title: "Поддержка — mipsy" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; layout?: string }>;
}) {
  const c = await loadCabinet("/me/podderzhka");
  const { layout, canSwitch } = await resolveLayout(searchParams);
  const sp = await searchParams;
  if (layout === 4) onePageRedirect("podderzhka", sp.v);

  return (
    <CabinetShell layout={layout} active="podderzhka" badges={cabinetBadges(c)}>
      <PodderzhkaBody c={c} />
      <CabinetSwitchers canSwitch={canSwitch} layout={layout} />
    </CabinetShell>
  );
}
