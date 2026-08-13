"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmLoginCode, requestLoginCode } from "./actions";

/** Вход по почте: письмо с кодом, дальше сессия на этом устройстве. */
export function LoginForm({ next, sender }: { next?: string; sender?: string | null }) {
  const router = useRouter();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
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
        setCode("");
        setStage("code");
      }
    });

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const res = await confirmLoginCode(email, code);
      if (!res.ok) setError(res.error);
      else {
        router.push(next && next.startsWith("/") ? next : res.path);
        router.refresh();
      }
    });

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <Link href="/" className="text-xl font-bold text-brand-700">
        mipsy
      </Link>
      <h1 className="mt-6 text-xl font-bold">Вход в личный кабинет</h1>

      {stage === "email" ? (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Введите почту — пришлём короткий код. Пароль придумывать не нужно, и неважно, были вы у
            нас раньше или заходите впервые.
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
            Код отправлен на {sentTo}. Введите шесть цифр — код действует 15 минут. Если вы у нас
            впервые, ничего страшного: код в письме тот же, а дальше предложим анкету.
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && confirm()}
            placeholder="000000"
            className="mt-6 h-14 text-center text-2xl tracking-widest"
            autoFocus
          />
          <Button
            className="mt-4 w-full"
            disabled={pending || code.length !== 6}
            onClick={confirm}
          >
            {pending ? "Проверяем…" : "Войти"}
          </Button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {/*
            Письма может не быть вовсе — например, если этой почты у нас нет.
            Прямо сказать об этом нельзя (иначе перебором адресов подтвердим,
            кто обращался к психологам), поэтому даём выход, а не намёк.
          */}
          <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm">
            <div className="font-semibold text-brand-800">Письмо не пришло?</div>
            <ul className="mt-2 space-y-1.5 text-neutral-700">
              <li>
                Загляните в «Спам»{sender ? <> — письмо приходит с адреса {sender}</> : null}.
              </li>
              <li>
                Проверьте адрес: код уходит только на ту почту, которую вы указывали в анкете или в
                заявке психолога.
              </li>
              <li>Письмо приходит и тем, кто у нас впервые, — отдельно регистрироваться не нужно.</li>
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
                <Link href="/psy">Я психолог</Link>
              </Button>
            </div>
          </div>
        </>
      )}

      {stage === "email" && error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
