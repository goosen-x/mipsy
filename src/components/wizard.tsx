"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Каркас пошаговой анкеты: прогресс, «назад», карточка вопроса. Общий для
 * анкеты клиента и заявки психолога — один шаг на экран, без простыней.
 */

export function Shell({
  children,
  progress,
  onBack,
  footer,
}: {
  children: React.ReactNode;
  progress: number;
  onBack: (() => void) | null;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-50/50">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
        <button
          type="button"
          onClick={onBack ?? undefined}
          className={cn(
            "text-sm text-neutral-500 hover:text-brand-700",
            !onBack && "invisible",
          )}
        >
          ← Назад
        </button>
        <Link href="/" className="text-xl font-bold text-brand-700">
          mipsy
        </Link>
      </header>
      <div className="mx-auto max-w-xl px-4">
        <Progress value={progress} className="h-1.5" />
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
        {footer ?? <div className="py-6" />}
      </div>
    </div>
  );
}

export function Question({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-2 text-neutral-500">{subtitle}</p>}
      <div className="mt-6 space-y-2">{children}</div>
    </div>
  );
}

export function OptionButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-base transition-colors",
        active
          ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
          : "border-neutral-200 hover:border-brand-400",
        disabled && "cursor-not-allowed opacity-50 hover:border-neutral-200",
      )}
    >
      {children}
    </button>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">{children}</div>
  );
}
