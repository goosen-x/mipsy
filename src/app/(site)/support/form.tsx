"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGuestTicket } from "./actions";

export function SupportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="rounded-2xl bg-brand-50 p-6">
        <p className="font-medium text-brand-800">Обращение принято.</p>
        <p className="mt-2 text-sm text-neutral-700">
          Ответим письмом на {email} в течение рабочего дня.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const res = await createGuestTicket({ name, email, body, website });
          if (res.ok) setSent(true);
          else setError(res.error ?? "Не получилось отправить — попробуйте ещё раз");
        });
      }}
    >
      <div>
        <label className="text-sm font-medium" htmlFor="support-name">
          Как вас зовут
        </label>
        <Input
          id="support-name"
          className="mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="support-email">
          Почта для ответа
        </label>
        <Input
          id="support-email"
          type="email"
          className="mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="support-body">
          Что случилось
        </label>
        <Textarea
          id="support-body"
          rows={5}
          className="mt-1"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Например: не приходит код для входа, вопрос про оплату или запись"
        />
      </div>
      {/* honeypot: людям не показывается, боты заполняют */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Отправляем…" : "Отправить"}
      </Button>
    </form>
  );
}
