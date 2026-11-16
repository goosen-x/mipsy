import Link from "next/link";
import { currentAccount, homePathFor } from "@/lib/auth";
import { AccountMenu } from "./account-menu";
import { SiteNav } from "./site-nav";
import { SITE_SECTIONS } from "./site-sections";
import { MobileNav } from "./mobile-nav";
import { HeaderLockup } from "./logo";
import { ORG } from "@/lib/org";



/**
 * Единая шапка сайта и кабинетов (подключается в app/(site)/layout.tsx).
 * Без входа — «Войти» и «Подобрать психолога», после входа — «Мой кабинет»
 * и меню аккаунта.
 */
export async function SiteHeader() {
  const account = await currentAccount();
  const cabinet = account ? await homePathFor(account.id) : null;

  return (
    <header className="relative z-30 border-b border-neutral-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <HeaderLockup />
        <SiteNav />
        <div className="hidden items-center gap-5 text-sm sm:flex">
          {account && cabinet ? (
            <AccountMenu cabinet={cabinet} name={account.name} email={account.email} />
          ) : (
            <>
              <Link href="/psihologam" className="text-neutral-600 hover:text-brand-700">
                Я психолог
              </Link>
              <Link href="/login" className="text-neutral-600 hover:text-brand-700">
                Войти
              </Link>
              <Link
                href="/login?next=%2Fanketa"
                className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
              >
                Подобрать психолога
              </Link>
            </>
          )}
        </div>
        <MobileNav cabinet={cabinet} signedIn={Boolean(account)} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer data-site-footer className="border-t border-neutral-100 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <HeaderLockup size="sm" />
            <p className="mt-3 text-neutral-500">Проект Московского института психологии (МИП)</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/oferta" className="hover:text-brand-700">
              Пользовательское соглашение
            </Link>
            <Link href="/privacy" className="hover:text-brand-700">
              Политика обработки персональных данных
            </Link>
            <Link href="/soglasie" className="hover:text-brand-700">
              Согласие на обработку данных
            </Link>
            <Link href="/rassylka" className="hover:text-brand-700">
              Согласие на рассылку
            </Link>
            <Link href="/rules" className="hover:text-brand-700">
              Правила безопасной консультации
            </Link>
            <Link href="/ethics" className="hover:text-brand-700">
              Стандарты и этика для психологов
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {SITE_SECTIONS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-brand-700">
                {l.label}
              </Link>
            ))}
            <Link href="/psihologi" className="hover:text-brand-700">
              Психологи
            </Link>
            <Link href="/psihologam" className="hover:text-brand-700">
              Я психолог
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/support" className="font-medium text-neutral-800 hover:text-brand-700">
              Поддержка
            </Link>
            <Link href="/faq" className="hover:text-brand-700">
              Частые вопросы
            </Link>
            <Link href="/crisis" className="hover:text-brand-700">
              Срочная помощь
            </Link>
            <a href={`tel:${ORG.phone.replace(/[^+\d]/g, "")}`} className="hover:text-brand-700">
              {ORG.phone}
            </a>
            <a href={`mailto:${ORG.email}`} className="hover:text-brand-700">
              {ORG.email}
            </a>
          </div>
        </div>
        <div className="mt-8 border-t border-dashed border-neutral-200 pt-4 text-xs text-neutral-400">
          © {new Date().getFullYear()} mipsy · {ORG.fullName} ({ORG.shortName}) · ИНН {ORG.inn} ·
          ОГРН {ORG.ogrn} · {ORG.address}
        </div>
      </div>
    </footer>
  );
}
