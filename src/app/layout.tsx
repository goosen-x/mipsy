import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mipsy — мы подберём вам психолога",
  description:
    "Ответьте на несколько вопросов — и мы вручную подберём психолога под ваш запрос. Не подошёл — бесплатно переподберём.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
