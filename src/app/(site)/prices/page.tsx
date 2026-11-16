import { currentAccountId } from "@/lib/auth";
import { PricesSection } from "@/components/home-sections";

export const metadata = { title: "Тарифы — mipsy" };

export default async function Page() {
  const accountId = await currentAccountId();
  // Подбор начинается с анкеты; без входа — через вход и сразу в анкету.
  const startHref = accountId ? "/anketa" : "/login?next=%2Fanketa";

  return (
    <main>
      <PricesSection startHref={startHref} asPage />
    </main>
  );
}
