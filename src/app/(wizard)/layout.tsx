import { SiteHeader } from "@/components/site";

/**
 * Пошаговые анкеты: общая шапка, без футера. Фон тянется до низа экрана,
 * карточка вопроса закреплена сверху — при смене вопроса меняется только её
 * нижний край, страница не скачет.
 */
export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-brand-50/50">
      <SiteHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
