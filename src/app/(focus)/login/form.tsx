"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { confirmLoginCode, requestLoginCode } from "./actions";

// Переменные для поля кода uiarc — в палитре сайта.
const OTP_THEME = {
  "--accent": "#855edf",
  "--accent-strong": "#6e47cc",
  "--accent-subtle": "#f7f4fd",
  "--surface": "#ffffff",
  "--surface-muted": "#fafafa",
  "--border-strong": "#c3b0f0",
  "--danger": "#dc2626",
  "--text-muted": "#737373",
  "--radius-control": "12px",
  "--duration-fast": "160ms",
  "--ease-standard": "cubic-bezier(0.22, 1, 0.36, 1)",
  "--text-xs": "0.875rem",
  "--text-sm": "0.875rem",
  "--text-lg": "1.5rem",
  "--leading-body": "1.5",
} as React.CSSProperties;

/** Вход по почте: письмо с кодом, дальше сессия на этом устройстве. */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setError(null);
      const res = await requestLoginCode(email);
      if (!res.ok) setError(res.error ?? "Не получилось отправить код");
      else {
        setSentTo(res.sentTo ?? "");
        setDevCode(res.devCode ?? null);
        setCode("");
        setStage("code");
      }
    });

  const confirm = (value = code) =>
    startTransition(async () => {
      setError(null);
      const res = await confirmLoginCode(email, value);
      if (!res.ok) setError(res.error);
      else {
        router.push(next && next.startsWith("/") ? next : res.path);
        router.refresh();
      }
    });

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold">Вход в личный кабинет</h1>

      {stage === "email" ? (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Введите почту. Мы отправим код для входа. Пароль и регистрация не нужны.
          </p>
          <Label htmlFor="email" className="mt-6 block">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && email.trim() && send()}
            placeholder="ivan@example.com"
            className="mt-1"
            autoFocus
          />
          <Button className="mt-4 w-full" disabled={pending || !email.trim()} onClick={send}>
            {pending ? "Отправляем…" : "Получить код"}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Мы отправили код на {sentTo}. Введите код из письма. Код действует 15 минут.
          </p>
          {devCode && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                Локальный режим: код <strong className="tracking-widest">{devCode}</strong>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCode(devCode);
                  confirm(devCode);
                }}
              >
                Войти с ним
              </Button>
            </div>
          )}
          {/* Компонент uiarc ждёт свои CSS-переменные; --accent у shadcn — светлый фон,
              поэтому задаём их здесь, только для этого поля. */}
          <div className="mt-6" style={OTP_THEME}>
            <OtpInput
              label="Код из письма"
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
                // Шестая цифра — сразу вход, без лишнего нажатия.
                if (value.length === 6 && !pending) confirm(value);
              }}
              error={error ?? undefined}
              autoFocus
            />
          </div>
          <Button
            className="mt-4 w-full"
            disabled={pending || code.length !== 6}
            onClick={() => confirm()}
          >
            {pending ? "Проверяем…" : "Войти"}
          </Button>

          {/*
            Письма может не быть вовсе — например, если этой почты у нас нет.
            Прямо сказать об этом нельзя (иначе перебором адресов подтвердим,
            кто обращался к психологам), поэтому даём выход, а не намёк.
          */}
          <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm">
            <div className="font-semibold text-brand-800">Письмо не пришло?</div>
            <ul className="mt-2 space-y-1.5 text-neutral-700">
              <li>
                Проверьте папку «Спам».
              </li>
              <li>Проверьте адрес почты.</li>
              <li>
                Письма нет —{" "}
                <Link href="/support" className="font-medium text-brand-700 underline">
                  напишите в поддержку
                </Link>
                .
              </li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStage("email");
                  setError(null);
                }}
              >
                Другая почта
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/psihologam">Я психолог</Link>
              </Button>
            </div>
          </div>
        </>
      )}

      {stage === "email" && error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
