import Link from "next/link";
import { FaqList } from "@/components/faq-list";
import { CLIENT_FAQ } from "@/content/faq";

export const metadata = { title: "Частые вопросы — mipsy" };

export default function FaqPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl font-bold">Частые вопросы</h1>
        <FaqList items={CLIENT_FAQ} className="mt-8" />
        <p className="mt-8 text-neutral-600">
          Подробнее о ваших правах на консультации —{" "}
          <Link href="/rules" className="text-brand-700 underline">
            Правила безопасной психологической консультации
          </Link>
          . Вопросы специалистов — на странице{" "}
          <Link href="/psihologam" className="text-brand-700 underline">
            для психологов
          </Link>
          .
        </p>
      </main>
    </>
  );
}
