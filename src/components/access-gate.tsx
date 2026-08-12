"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Экран подтверждения входа в личный кабинет с нового устройства.
 * Ссылка сама по себе доступ не даёт — нужен код, который приходит владельцу.
 */
export function AccessGate({
  hint,
  onSend,
  onCheck,
}: {
  hint: string;
  onSend: () => Promise<{ ok: boolean; sentTo?: string; error?: string }>;
  onCheck: (code: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"start" | "code">("start");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <Link href="/" className="text-xl font-bold text-brand-700">
          mipsy
        </Link>
        <h1 className="mt-6 text-xl font-bold">Подтвердите, что это вы</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {stage === "start"
            ? `Страница личная: на ней ${hint}. Мы отправим короткий код — введите его, и дальше это устройство будет узнавать вас автоматически.`
            : `Код отправлен${sentTo ? ` на ${sentTo}` : ""}. Введите шесть цифр.`}
        </p>

        {stage === "start" ? (
          <Button
            className="mt-6 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await onSend();
                if (!res.ok) setError(res.error ?? "Не получилось отправить код");
                else {
                  setSentTo(res.sentTo ?? "");
                  setStage("code");
                }
              })
            }
          >
            {pending ? "Отправляем…" : "Получить код"}
          </Button>
        ) : (
          <>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="mt-6 h-14 text-center text-2xl tracking-widest"
              autoFocus
            />
            <Button
              className="mt-4 w-full"
              disabled={pending || code.length !== 6}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await onCheck(code);
                  if (!res.ok) setError(res.error ?? "Неверный код");
                  else router.refresh();
                })
              }
            >
              {pending ? "Проверяем…" : "Войти"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStage("start");
                setCode("");
              }}
              className="mt-3 w-full text-sm text-neutral-500 hover:text-brand-700"
            >
              Отправить код ещё раз
            </button>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-6 text-xs text-neutral-400">
          Если код не приходит, позвоните оператору — он поможет войти.
        </p>
      </div>
    </div>
  );
}
