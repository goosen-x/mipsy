import { loadCabinet } from "../data";
import { onePageRedirect, resolveLayout } from "../layout-config";
import { OplatyBody } from "../sections";
import { CabinetShell, cabinetBadges } from "../shell";
import { CabinetSwitchers } from "../switchers";

export const metadata = { title: "Оплаты — mipsy" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; layout?: string }>;
}) {
  const c = await loadCabinet("/me/oplaty");
  const { layout, canSwitch } = await resolveLayout(searchParams);
  const sp = await searchParams;
  if (layout === 4) onePageRedirect("oplaty", sp.v);

  return (
    <CabinetShell layout={layout} active="oplaty" badges={cabinetBadges(c)}>
      <OplatyBody c={c} />
      <CabinetSwitchers canSwitch={canSwitch} layout={layout} />
    </CabinetShell>
  );
}
