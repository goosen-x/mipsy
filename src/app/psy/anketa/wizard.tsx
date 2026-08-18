"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Hint, OptionButton, Question, Shell } from "@/components/wizard";
import { isValidPhone } from "@/lib/rules";
import { submitPsyApplication } from "../actions";
import { uploadEducationDoc } from "../upload";

const STEPS = [
  "name",
  "gender",
  "birthYear",
  "phone",
  "education",
  "docs",
  "experience",
  "supervision",
  "therapy",
  "confirm",
] as const;

/** Заявка психолога тем же ритмом, что анкета клиента: один вопрос на экран. */
export function PsyApplicationWizard({ email }: { email: string }) {
  const [form, setForm] = useState({
    name: "",
    gender: "",
    birthYear: "",
    phone: "",
    education: "",
    experienceYears: "",
    supervision: "",
    personalTherapy: "",
  });
  const [docs, setDocs] = useState<{ url: string; name: string }[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  // Черновик переживает случайное обновление страницы; загруженные файлы уже
  // лежат на сервере, поэтому восстанавливаем и их список.
  const draftKey = `mipsy-psy-draft:${email}`;
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.form) setForm((prev) => ({ ...prev, ...d.form }));
        if (Array.isArray(d?.docs)) setDocs(d.docs);
        if (typeof d?.stepIdx === "number") setStepIdx(Math.min(d.stepIdx, STEPS.length - 1));
      }
    } catch {}
    setRestored(true);
  }, [draftKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, docs, stepIdx }));
    } catch {}
  }, [restored, draftKey, form, docs, stepIdx]);

  const step = STEPS[stepIdx];
  const progress = Math.round((stepIdx / STEPS.length) * 100);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));
  const pick = (key: keyof typeof form, value: string) => {
    set(key, value);
    setTimeout(next, 180);
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitPsyApplication({
        name: form.name,
        gender: form.gender,
        birthYear: form.birthYear ? Number(form.birthYear) : null,
        phone: form.phone,
        education: form.education,
        educationDocs: docs.map((d) => d.url),
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
        <h1 className="text-3xl font-bold">Заявка отправлена!</h1>
        <p className="mt-4 text-lg text-neutral-600">
          Мы изучим её и позвоним вам. Кабинет уже открыт — в нём можно заполнить профиль, после
          одобрения он станет публичным.
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
    <Shell progress={progress} onBack={stepIdx > 0 ? back : null}>
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
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+7 900 000-00-00"
            className="h-14 text-lg"
          />
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

      {step === "education" && (
        <Question
          title="Расскажите об образовании"
          subtitle="Вузы, программы переподготовки, обучение подходу, годы окончания."
        >
          <Textarea
            rows={5}
            value={form.education}
            onChange={(e) => set("education", e.target.value)}
          />
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={!form.education.trim()}
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "docs" && (
        <Question
          title="Документы об образовании"
          subtitle="Сканы дипломов и сертификатов: PDF, JPG или PNG до 10 МБ. Их увидит только модерация."
        >
          {docs.length > 0 && (
            <ul className="space-y-1 text-sm">
              {docs.map((d) => (
                <li key={d.url} className="flex items-center gap-2">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 underline"
                  >
                    {d.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setDocs(docs.filter((x) => x.url !== d.url))}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Убрать документ"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-700"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              // До отправки: файл больше серверного лимита оборвал бы запрос.
              if (file.size > 10 * 1024 * 1024) {
                setError("Файл больше 10 МБ — сожмите скан или сохраните в меньшем размере");
                return;
              }
              const fd = new FormData();
              fd.set("doc", file);
              setError(null);
              startTransition(async () => {
                const res = await uploadEducationDoc(fd);
                if (res.ok) setDocs((prev) => [...prev, { url: res.url, name: res.name }]);
                else setError(res.error);
              });
            }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={pending || docs.length === 0}
            onClick={next}
          >
            {pending ? "Загружаем…" : "Продолжить"}
          </Button>
          <Hint>Без документов заявку не рассмотреть — приложите хотя бы один.</Hint>
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
          subtitle="Проходите ли супервизию, как регулярно, у кого. Необязательно — уточним при созвоне."
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
          subtitle="Есть ли опыт личной терапии, как давно. Необязательно."
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
            <Row k="Документов" v={String(docs.length)} />
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
            После отправки мы изучим заявку и позвоним. Профиль можно заполнять сразу — публичным
            он станет после одобрения.
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
