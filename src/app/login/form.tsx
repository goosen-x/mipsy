"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmLoginCode, requestLoginCode } from "./actions";

/** Вход по почте: письмо с кодом, дальше сессия на этом устройстве. */
export function LoginForm({ next }: { next?: string }) {
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
            Введите почту, которую указывали в анкете или в заявке психолога. Мы отправим на неё
            короткий код — пароль придумывать не нужно.
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
            Если такая почта у нас есть, код уже отправлен на {sentTo}. Введите шесть цифр — код
            действует 15 минут.
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
          <button
            type="button"
            onClick={() => {
              setStage("email");
              setError(null);
            }}
            className="mt-3 w-full text-sm text-neutral-500 hover:text-brand-700"
          >
            Ввести другую почту или получить код заново
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-6 border-t pt-4 text-xs text-neutral-400">
        Ещё не обращались к нам?{" "}
        <Link href="/anketa" className="text-brand-700 underline">
          Пройдите анкету
        </Link>{" "}
        — кабинет создастся сам. Психологам —{" "}
        <Link href="/psy" className="text-brand-700 underline">
          заявка на модерацию
        </Link>
        . Если код не приходит, позвоните оператору.
      </p>
    </div>
  );
}
