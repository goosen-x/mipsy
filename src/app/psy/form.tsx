"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitPsyApplication } from "./actions";

export function PsyApplicationForm({ email }: { email: string }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    education: "",
    educationDocs: "",
    experienceYears: "",
    supervision: "",
    personalTherapy: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitPsyApplication({
        name: form.name,
        phone: form.phone,
        education: form.education,
        educationDocs: form.educationDocs,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : null,
        supervision: form.supervision,
        personalTherapy: form.personalTherapy,
      });
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
        <h3 className="text-xl font-semibold text-brand-800">Заявка отправлена!</h3>
        <p className="mt-2 text-neutral-700">
          Мы изучим её и позвоним вам. Кабинет уже открыт — в нём можно заполнить профиль, после
          одобрения он станет публичным.
        </p>
        <p className="mt-4">
          <Link
            href="/cab"
            className="inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
          >
            Перейти в кабинет
          </Link>
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          С другого устройства вход по адресу {email} — пришлём код на почту.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Имя и фамилия" required>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Анна Иванова" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Телефон" required>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+7 900 000-00-00"
          />
        </Field>
        <Field label="Email" hint="Вход в кабинет и письма о записях">
          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm">
            <span className="text-neutral-600">Подтверждён: </span>
            <span className="font-medium text-brand-800">{email}</span>
          </div>
        </Field>
      </div>
      <Field label="Образование" required hint="Вузы, программы переподготовки, годы окончания">
        <Textarea rows={3} value={form.education} onChange={(e) => set("education", e.target.value)} />
      </Field>
      <Field
        label="Документы об образовании"
        hint="Ссылки на сканы (диск, облако) — или напишите, что предоставите при созвоне"
      >
        <Textarea
          rows={2}
          value={form.educationDocs}
          onChange={(e) => set("educationDocs", e.target.value)}
        />
      </Field>
      <Field label="Опыт практики, лет">
        <Input
          type="number"
          min={0}
          max={60}
          value={form.experienceYears}
          onChange={(e) => set("experienceYears", e.target.value)}
          className="max-w-32"
        />
      </Field>
      <Field label="Супервизия" hint="Проходите ли супервизию, как регулярно, у кого">
        <Textarea rows={2} value={form.supervision} onChange={(e) => set("supervision", e.target.value)} />
      </Field>
      <Field label="Личная терапия" hint="Есть ли опыт личной терапии, как давно">
        <Textarea
          rows={2}
          value={form.personalTherapy}
          onChange={(e) => set("personalTherapy", e.target.value)}
        />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        size="lg"
        disabled={pending || !form.name.trim() || !form.phone.trim() || !form.education.trim()}
        onClick={submit}
      >
        {pending ? "Отправляем…" : "Отправить заявку"}
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 block">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
