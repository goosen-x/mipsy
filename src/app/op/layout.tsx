import Link from "next/link";
import { isOperator } from "@/lib/op-auth";
import { LoginForm, LogoutButton } from "./auth-ui";

export const metadata = { title: "Оператор — mipsy" };
export const dynamic = "force-dynamic";

export default async function OpLayout({ children }: { children: React.ReactNode }) {
  const authed = await isOperator();

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold">
            <span className="text-brand-700">mipsy</span> · вход оператора
          </h1>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/op" className="text-lg font-bold text-brand-700">
              mipsy · оператор
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/op" className="text-neutral-600 hover:text-brand-700">
                Клиенты
              </Link>
              <Link href="/op/psy" className="text-neutral-600 hover:text-brand-700">
                Психологи
              </Link>
              <Link href="/op/reviews" className="text-neutral-600 hover:text-brand-700">
                Отзывы
              </Link>
              <Link href="/op/support" className="text-neutral-600 hover:text-brand-700">
                Поддержка
              </Link>
              <Link href="/op/notifications" className="text-neutral-600 hover:text-brand-700">
                Уведомления
              </Link>
              <Link href="/op/stats" className="text-neutral-600 hover:text-brand-700">
                Аналитика
              </Link>
              <Link href="/op/errors" className="text-neutral-600 hover:text-brand-700">
                Ошибки
              </Link>
              <Link href="/op/audit" className="text-neutral-600 hover:text-brand-700">
                Журнал
              </Link>
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
