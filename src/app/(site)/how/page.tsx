import { currentAccountId } from "@/lib/auth";
import { HowSection } from "@/components/home-sections";

export const metadata = { title: "Как это работает — mipsy" };

export default async function Page() {
  const accountId = await currentAccountId();
  // Подбор начинается с анкеты; без входа — через вход и сразу в анкету.
  const startHref = accountId ? "/anketa" : "/login?next=%2Fanketa";

  return (
    <main>
      <HowSection startHref={startHref} asPage />
    </main>
  );
}
