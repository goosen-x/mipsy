import Link from "next/link";
import { formatSlot } from "@/lib/datetime";
import { gradePriceLabel } from "@/lib/grades";
import { loadCabinet } from "../data";
import { PayButtons } from "../pay";
import { CabinetShell, cabinetBadges, SectionTitle } from "../shell";

export const metadata = { title: "Оплаты — mipsy" };
export const dynamic = "force-dynamic";

export default async function OplatyPage() {
  const c = await loadCabinet("/me/oplaty");
  const { chosen, upcoming, past, payProviders } = c;
  const unpaid = upcoming.filter((s) => !s.paidAt);
  const paid = [...upcoming, ...past].filter((s) => s.paidAt);
  const price = chosen ? gradePriceLabel(chosen.psy.grade) : null;

  return (
    <CabinetShell active="oplaty" badges={cabinetBadges(c)}>
      <SectionTitle sub={price ? `Сессия с ${chosen!.psy.name} стоит ${price}.` : undefined}>
        Оплаты
      </SectionTitle>

      <section>
        <h2 className="text-lg font-bold">К оплате</h2>
        {unpaid.length === 0 ? (
          <p className="mt-2 text-neutral-500">
            Неоплаченных встреч нет.{" "}
            {upcoming.length === 0 && (
              <Link href="/me/vstrechi" className="text-brand-700 underline">
                Записаться на встречу
              </Link>
            )}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {unpaid.map((s) => {
              const sessionPrice = gradePriceLabel(s.psyGrade);
              return (
                <li key={s.id} className="py-4">
                  <div className="font-medium">{formatSlot(s.startsAt)}</div>
                  <div className="text-sm text-neutral-500">
                    с {s.psyName}
                    {sessionPrice ? ` · ${sessionPrice}` : ""}
                  </div>
                  {sessionPrice && payProviders.length > 0 ? (
                    <PayButtons slotId={s.id} priceLabel={sessionPrice} providers={payProviders} />
                  ) : (
                    <p className="mt-2 text-sm text-neutral-400">
                      Онлайн-оплата на платформе появится позже.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {paid.length > 0 && (
        <section className="border-t border-neutral-100 pt-8">
          <h2 className="text-lg font-bold">Оплачено</h2>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {paid.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  {formatSlot(s.startsAt)} · {s.psyName}
                </span>
                <span className="text-neutral-500">{gradePriceLabel(s.psyGrade) ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </CabinetShell>
  );
}
