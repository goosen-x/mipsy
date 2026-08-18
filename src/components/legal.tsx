import { SiteFooter, SiteHeader } from "@/components/site";

/**
 * Каркас юридических страниц. Тексты — черновики до вычитки юристом;
 * места, требующие реальных реквизитов, помечены [СКОБКАМИ].
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="prose-legal mt-8 space-y-4 text-[15px] leading-relaxed text-neutral-700 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
