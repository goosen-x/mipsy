import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount, isAdmin } from "@/lib/auth";
import { signOutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Админ — mipsy" };
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Клиенты"],
  ["/admin/psy", "Психологи"],
  ["/admin/reviews", "Отзывы"],
  ["/admin/support", "Поддержка"],
  ["/admin/notifications", "Уведомления"],
  ["/admin/payments", "Оплаты"],
  ["/admin/stats", "Аналитика"],
  ["/admin/errors", "Ошибки"],
  ["/admin/audit", "Журнал"],
  ["/admin/team", "Команда"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fadmin");

  if (!(await isAdmin())) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-100 p-8">
          <h1 className="text-xl font-bold">Здесь только для админов</h1>
          <p className="mt-3 text-neutral-600">
            Вы вошли как {account.email}, но у этого аккаунта нет прав админа. Если они нужны —
            попросите коллегу выдать их на странице «Команда».
          </p>
          <Link href="/me" className="mt-6 inline-block font-medium text-brand-700 underline">
            В мой кабинет
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 text-lg font-bold text-brand-700"
          >
            <span aria-hidden className="h-3 w-3 rounded-full bg-brand-600" />
            mipsy · админ
          </Link>
          <form action={signOutAction} className="order-1 flex items-center gap-3 sm:order-2">
            <span className="hidden text-sm text-neutral-400 sm:inline">{account.name}</span>
            <Button variant="ghost" size="sm" type="submit">
              Выйти
            </Button>
          </form>
          <nav className="order-2 flex w-full gap-4 overflow-x-auto pb-1 text-sm whitespace-nowrap sm:order-1 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
            {NAV.map(([href, title]) => (
              <Link key={href} href={href} className="text-neutral-600 hover:text-brand-700">
                {title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
