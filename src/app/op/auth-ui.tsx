"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { opLogin, opLogout } from "./actions";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await opLogin(password);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Ошибка входа");
    });
  }

  return (
    <div>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Пароль"
        autoFocus
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <Button className="mt-4 w-full" disabled={pending || !password} onClick={submit}>
        {pending ? "Входим…" : "Войти"}
      </Button>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => { await opLogout(); router.refresh(); })}
    >
      Выйти
    </Button>
  );
}
