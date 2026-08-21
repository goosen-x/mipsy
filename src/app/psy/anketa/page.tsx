import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { CabinetHeader } from "@/components/site";
import { currentAccount } from "@/lib/auth";
import { PsyApplicationWizard } from "./wizard";

export const metadata = { title: "Заявка психолога — mipsy" };
export const dynamic = "force-dynamic";

export default async function PsyAnketaPage() {
  // Заявка — за входом: почта подтверждена, заявка не привяжется к чужому адресу.
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fpsy%2Fanketa");

  // Повторная заявка не нужна — у этого аккаунта уже есть кабинет специалиста.
  const [existing] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, account.id));
  if (existing) redirect("/cab");

  // Одна почта — один кабинет. Отказ показываем до анкеты: заполнить восемь
  // шагов и получить ошибку на отправке — худшее, что можно предложить.
  if (account.role === "client") {
    return (
      <div className="min-h-screen bg-white">
        <CabinetHeader title={account.name} />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="text-2xl font-bold">Эта почта — кабинет клиента</h1>
          <p className="mt-3 text-neutral-600">
            На {account.email} заведён кабинет клиента, а кабинет специалиста живёт отдельно: так
            заявки, брони и профиль не перемешиваются. Чтобы работать на платформе психологом,
            выйдите и войдите с другого адреса — заявку подайте уже оттуда.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
            >
              Войти с другой почты
            </Link>
            <Link
              href="/me"
              className="rounded-lg border border-neutral-200 px-5 py-2.5 font-medium hover:border-brand-400"
            >
              Вернуться в кабинет
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <PsyApplicationWizard email={account.email} />;
}
