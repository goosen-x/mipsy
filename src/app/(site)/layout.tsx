import { SiteFooter, SiteHeader } from "@/components/site";

/** Сайт и кабинеты: одна шапка и один футер на все страницы группы. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
