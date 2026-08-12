import Link from "next/link";

export function SiteHeader() {
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
