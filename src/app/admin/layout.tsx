import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount, isAdmin } from "@/lib/auth";
import { signOutAction } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { loadAdminCounts } from "@/lib/admin-queue";
import { AdminNav } from "./admin-nav";

export const metadata = { title: "Админ — mipsy" };
export const dynamic = "force-dynamic";



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

  const counts = await loadAdminCounts();
  return (
    <div className="min-h-screen bg-neutral-50 lg:flex">
      <AdminNav
        counts={counts}
        name={account.name}
        signOut={
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit" className="w-full justify-start text-neutral-500">
              Выйти
            </Button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
