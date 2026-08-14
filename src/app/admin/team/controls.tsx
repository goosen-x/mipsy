"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { grantAdmin, revokeAdmin } from "../actions";

export function TeamControls() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await grantAdmin(email);
      if (res.ok) {
        setEmail("");
        toast.success("Права выданы");
      } else {
        setError(res.error ?? "Не получилось");
      }
    });
  }

  return (
    <div>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="почта аккаунта"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <Button className="mt-3" disabled={pending || !email} onClick={submit}>
        {pending ? "Выдаём…" : "Сделать админом"}
      </Button>
    </div>
  );
}

export function RevokeButton({ accountId, email }: { accountId: number; email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Снять права админа у ${email}?`)) return;
        startTransition(async () => {
          const res = await revokeAdmin(accountId);
          if (res.ok) toast.success("Права сняты");
          else toast.error(res.error ?? "Не получилось");
        });
      }}
    >
      Снять права
    </Button>
  );
}
