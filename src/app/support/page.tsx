import { SiteFooter, SiteHeader } from "@/components/site";
import { SupportForm } from "./form";

export const metadata = { title: "Поддержка — mipsy" };

/**
 * Публичный канал поддержки: работает без входа — специально для тех, кто
 * в кабинет попасть не может (не приходит код, сменилась почта).
 */
export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Написать в поддержку</h1>
        <p className="mt-4 text-neutral-700">
          Ответим письмом в течение рабочего дня. Если вопрос про вход — опишите, на какую почту
          не приходит код: разберёмся и откроем доступ.
        </p>
        <div className="mt-8">
          <SupportForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
