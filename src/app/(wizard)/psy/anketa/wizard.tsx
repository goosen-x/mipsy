"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Hint, OptionButton, Question, Shell } from "@/components/wizard";
import { isValidPhone, phoneProblem } from "@/lib/rules";
import { PhoneInput } from "@/components/phone-input";
import { submitPsyApplication } from "../actions";

const STEPS = [
  "name",
  "gender",
  "birthYear",
  "phone",
  "experience",
  "supervision",
  "therapy",
  "confirm",
] as const;

/** Заявка психолога тем же ритмом, что анкета клиента: один вопрос на экран.
 * Образование и документы психолог дозаполняет в кабинете после регистрации. */
export function PsyApplicationWizard({ email }: { email: string }) {
  const [form, setForm] = useState({
    name: "",
    gender: "",
    birthYear: "",
    phone: "",
    experienceYears: "",
    supervision: "",
    personalTherapy: "",
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [maxIdx, setMaxIdx] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  // Черновик переживает случайное обновление страницы.
  const draftKey = `mipsy-psy-draft:${email}`;
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.form) setForm((prev) => ({ ...prev, ...d.form }));
        if (typeof d?.stepIdx === "number") {
          setStepIdx(Math.min(d.stepIdx, STEPS.length - 1));
          setMaxIdx(Math.min(d.stepIdx, STEPS.length - 1));
        }
      }
    } catch {}
    setRestored(true);
  }, [draftKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, stepIdx }));
    } catch {}
  }, [restored, draftKey, form, stepIdx]);

  const step = STEPS[stepIdx];
  const progress = Math.round((stepIdx / STEPS.length) * 100);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const goTo = (idx: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const target = Math.max(0, Math.min(idx, STEPS.length - 1));
    setStepIdx(target);
    setMaxIdx((m) => Math.max(m, target));
  };
  const next = () => goTo(stepIdx + 1);
  const back = () => goTo(stepIdx - 1);
  // Переход — от вопроса, на котором кликнули: двойной клик не перепрыгнет вопрос.
  const pick = (key: keyof typeof form, value: string) => {
    set(key, value);
    const from = stepIdx;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => goTo(from + 1), 180);
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitPsyApplication({
        name: form.name,
        gender: form.gender,
        birthYear: form.birthYear ? Number(form.birthYear) : null,
        phone: form.phone,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : null,
        supervision: form.supervision,
        personalTherapy: form.personalTherapy,
      });
      if (res.ok) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        setSent(true);
      } else setError(res.error);
    });
  }

  if (sent) {
    return (
      <Shell progress={100} onBack={null}>
        <h1 className="text-3xl font-bold">Кабинет создан!</h1>
        <p className="mt-4 text-lg text-neutral-600">
          Осталось дозаполнить образование и приложить документы — без них заявку не рассмотреть.
          Сделать это можно прямо в кабинете.
        </p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/cab">Перейти в кабинет</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-neutral-500">
          С другого устройства вход по адресу {email} — пришлём код на почту.
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      progress={progress}
      onBack={stepIdx > 0 ? back : null}
      onForward={stepIdx < maxIdx ? next : null}
    >
      {step === "name" && (
        <Question title="Как вас зовут?" subtitle="Имя и фамилия — так вас увидят клиенты.">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Анна Иванова"
            className="h-14 text-lg"
            autoFocus
          />
          <Button className="mt-4 w-full" size="lg" disabled={!form.name.trim()} onClick={next}>
            Продолжить
          </Button>
        </Question>
      )}

      {step === "gender" && (
        <Question title="Ваш пол?" subtitle="Клиенты часто просят специалиста определённого пола.">
          {[
            ["female", "Женщина"],
            ["male", "Мужчина"],
          ].map(([v, label]) => (
            <OptionButton key={v} onClick={() => pick("gender", v)} active={form.gender === v}>
              {label}
            </OptionButton>
          ))}
        </Question>
      )}

      {step === "birthYear" && (
        <Question title="Год рождения?" subtitle="Возраст участвует в подборе и фильтрах каталога.">
          <Input
            type="number"
            inputMode="numeric"
            min={1930}
            max={2010}
            value={form.birthYear}
            onChange={(e) => set("birthYear", e.target.value)}
            placeholder="1985"
            className="h-14 text-lg"
          />
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={
              !form.birthYear || Number(form.birthYear) < 1930 || Number(form.birthYear) > 2010
            }
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "phone" && (
        <Question title="Телефон" subtitle="Позвоним после модерации и для координации записей.">
          <PhoneInput
            value={form.phone}
            onChange={(v) => set("phone", v)}
            invalid={form.phone.length > 4 && !isValidPhone(form.phone)}
          />
          {form.phone.length > 4 && !isValidPhone(form.phone) && (
            <p className="mt-2 text-sm text-red-600">{phoneProblem(form.phone)}</p>
          )}
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={!isValidPhone(form.phone)}
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "experience" && (
        <Question title="Опыт практики, лет" subtitle="Если меньше года — поставьте 0.">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={form.experienceYears}
            onChange={(e) => set("experienceYears", e.target.value)}
            placeholder="5"
            className="h-14 text-lg"
          />
          <Button className="mt-4 w-full" size="lg" onClick={next}>
            Продолжить
          </Button>
        </Question>
      )}

      {step === "supervision" && (
        <Question
          title="Супервизия"
          subtitle="Проходите ли супервизию, как регулярно. Заполняется по желанию — уточним при созвоне."
        >
          <Textarea
            rows={3}
            value={form.supervision}
            onChange={(e) => set("supervision", e.target.value)}
          />
          <Button className="mt-4 w-full" size="lg" onClick={next}>
            Продолжить
          </Button>
        </Question>
      )}

      {step === "therapy" && (
        <Question
          title="Личная терапия"
          subtitle="Есть ли опыт личной терапии, как давно. Заполняется по желанию."
        >
          <Textarea
            rows={3}
            value={form.personalTherapy}
            onChange={(e) => set("personalTherapy", e.target.value)}
          />
          <Button className="mt-4 w-full" size="lg" onClick={next}>
            Продолжить
          </Button>
        </Question>
      )}

      {step === "confirm" && (
        <Question title="Всё готово — отправляем?" subtitle="Проверьте, всё ли верно.">
          <dl className="space-y-2 rounded-xl bg-neutral-50 p-4 text-sm">
            <Row k="Имя" v={form.name} />
            <Row k="Пол" v={form.gender === "female" ? "Женщина" : "Мужчина"} />
            <Row k="Год рождения" v={form.birthYear} />
            <Row k="Телефон" v={form.phone} />
            <Row k="Почта для входа" v={email} />
          </dl>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-neutral-500">
            Отправляя заявку, вы соглашаетесь на{" "}
            <a href="/soglasie" target="_blank" className="text-brand-700 underline">
              обработку персональных данных
            </a>{" "}
            и с{" "}
            <a href="/oferta" target="_blank" className="text-brand-700 underline">
              условиями платформы
            </a>
            .
          </p>
          <Button className="mt-4 w-full" size="lg" disabled={pending} onClick={submit}>
            {pending ? "Отправляем…" : "Отправить заявку"}
          </Button>
          <Hint>
            Кабинет откроется сразу. Образование и документы донесите там — без них заявку не
            рассмотрим.
          </Hint>
        </Question>
      )}
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}
