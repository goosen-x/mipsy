import Link from "next/link";
import { SupportForm } from "../controls";
import { loadCabinet } from "../data";
import { CabinetShell, cabinetBadges, SectionTitle } from "../shell";

export const metadata = { title: "Поддержка — mipsy" };
export const dynamic = "force-dynamic";

export default async function PodderzhkaPage() {
  const c = await loadCabinet("/me/podderzhka");
  return (
    <CabinetShell active="podderzhka" badges={cabinetBadges(c)}>
      <SectionTitle
        sub={`Есть вопрос или что-то пошло не так? Напишите нам — оператор ответит на ${c.req.email ?? c.account.email}.`}
      >
        Поддержка
      </SectionTitle>
      <section>
        <SupportForm />
      </section>
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm text-red-900">
          Если станет совсем тяжело — не ждите ответа оператора:{" "}
          <Link href="/crisis" className="font-medium underline">
            телефоны круглосуточной поддержки
          </Link>
          .
        </p>
      </section>
    </CabinetShell>
  );
}
