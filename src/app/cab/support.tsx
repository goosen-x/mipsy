"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createPsyTicket } from "./actions";

/** Поддержка для психолога: спорные записи, неявки, вопросы по платформе. */
export function PsySupportForm() {
  const [kind, setKind] = useState<"question" | "complaint">("question");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
        Обращение принято. Оператор свяжется с вами в течение рабочего дня.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        {(
          [
            ["question", "Вопрос"],
            ["complaint", "Спорная ситуация"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setKind(v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              kind === v
                ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                : "border-neutral-200 hover:border-brand-400",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        className="mt-3"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Опишите ситуацию: встреча, клиент, что произошло"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <Button
        variant="outline"
        className="mt-3"
        disabled={pending || body.trim().length < 5}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createPsyTicket(kind, body);
            if (!res.ok) setError(res.error ?? "Не получилось");
            else {
              setSent(true);
              toast.success("Обращение принято");
            }
          })
        }
      >
        {pending ? "Отправляем…" : "Отправить"}
      </Button>
    </div>
  );
}
