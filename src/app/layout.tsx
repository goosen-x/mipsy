import type { Metadata } from "next";
import "./globals.css";
import { Mulish } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const mulish = Mulish({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "mipsy — мы подберём вам психолога",
  description:
    "Ответьте на несколько вопросов — и мы вручную подберём психолога под ваш запрос. Не подошёл — бесплатно переподберём.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={cn("font-sans", mulish.variable)}>
      <body>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
