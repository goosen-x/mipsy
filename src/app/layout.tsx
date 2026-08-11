import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "mipsy — мы подберём вам психолога",
  description:
    "Ответьте на несколько вопросов — и мы вручную подберём психолога под ваш запрос. Не подошёл — бесплатно переподберём.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={cn("font-sans", inter.variable)}>
      <body>{children}</body>
    </html>
  );
}
