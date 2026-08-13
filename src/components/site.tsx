import Link from "next/link";
import { currentAccountId, homePathFor } from "@/lib/auth";
import { signOutAction } from "@/app/logout/actions";

export async function SiteHeader() {
  const accountId = await currentAccountId();
  const cabinet = accountId ? await homePathFor(accountId) : null;

  return (
    <header className="border-b border-neutral-100">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-brand-700">
          mipsy
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/catalog" className="text-neutral-600 hover:text-brand-700">
            Психологи
          </Link>
          <Link href="/psy" className="text-neutral-600 hover:text-brand-700">
            Психологам
          </Link>
          {cabinet ? (
            <Link href={cabinet} className="font-medium text-brand-700 hover:text-brand-800">
              Мой кабинет
            </Link>
          ) : (
            <Link href="/login" className="text-neutral-600 hover:text-brand-700">
              Войти
            </Link>
          )}
          <Link
            href="/anketa"
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Подобрать психолога
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Шапка кабинета: имя владельца и выход. */
export function CabinetHeader({ title, wide }: { title: string; wide?: boolean }) {
  return (
    <header className="border-b bg-white">
      <div
        className={`mx-auto flex ${wide ? "max-w-4xl" : "max-w-3xl"} items-center justify-between px-4 py-4`}
      >
        <Link href="/" className="text-xl font-bold text-brand-700">
          mipsy
        </Link>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <span>{title}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-neutral-500 underline hover:text-brand-700">
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-100 bg-neutral-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-semibold text-brand-700">mipsy</span> · подбор психолога
        </div>
        <div className="flex gap-6">
          <Link href="/catalog" className="hover:text-brand-700">
            Психологи
          </Link>
          <Link href="/psy" className="hover:text-brand-700">
            Психологам
          </Link>
          <Link href="/crisis" className="hover:text-brand-700">
            Срочная помощь
          </Link>
        </div>
      </div>
    </footer>
  );
}
