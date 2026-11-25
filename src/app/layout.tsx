import type { Metadata } from "next";
import "./globals.css";
import { Onest } from "next/font/google";
import { cn } from "@/lib/utils";
import { indexingAllowed } from "@/lib/indexing";
import { Toaster } from "@/components/ui/sonner";

// Onest — шрифт логотипа mipsy (вариант 1), им же набран весь сайт.
const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });

// Пока индексация закрыта (lib/indexing.ts) — noindex на каждой странице.
export const metadata: Metadata = {
  robots: indexingAllowed() ? undefined : { index: false, follow: false },
  title: "mipsy — подберем вам психолога",
  description:
    "Ответьте на несколько вопросов, и мы подберем психолога под ваш запрос. Если не подойдет, бесплатно подберем другого.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" className={cn("font-sans", onest.variable)}>
      <body>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
