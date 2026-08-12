"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { updateProfile, type ProfileUpdate } from "./actions";
import { uploadPhoto } from "./upload";

type Topic = { slug: string; title: string };

const FORMATS = [
  ["online", "Онлайн"],
  ["offline", "Очно"],
  ["both", "Онлайн и очно"],
] as const;

// Простая проверка: в публичных полях профиля не должно быть контактов.
const CONTACT_RE = /(\+?\d[\d\s\-()]{8,})|@\w{2,}|(t\.me|wa\.me|vk\.com|instagram\.com)/i;

export function ProfileForm({
  token,
  topics,
  initial,
}: {
  token: string;
  topics: Topic[];
  initial: ProfileUpdate;
}) {
  const [form, setForm] = useState<ProfileUpdate>({
    ...initial,
    faq: initial.faq.length > 0 ? initial.faq : [{ q: "", a: "" }],
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ProfileUpdate>(key: K, value: ProfileUpdate[K]) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    setError(null);
    const publicText = [form.about, form.howSessions, form.approach, ...form.faq.flatMap((f) => [f.q, f.a])].join(" ");
    if (CONTACT_RE.test(publicText)) {
      setError(
        "Похоже, в тексте профиля есть телефон, ссылка или @-контакт. Уберите их, пожалуйста — вся связь с клиентами идёт через платформу.",
      );
      return;
    }
    startTransition(async () => {
      const res = await updateProfile(token, form);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Не получилось сохранить");
    });
  }

  return (
    <div className="space-y-5">
      <Field label="Фото" hint="JPG, PNG или WebP до 5 МБ. Лучше портрет крупным планом на светлом фоне">
        <div className="flex flex-wrap items-center gap-4">
          {form.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.photoUrl}
              alt="Ваше фото"
              className="h-24 w-24 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-brand-100 text-sm text-brand-700">
              нет фото
            </div>
          )}
          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white hover:file:bg-brand-700"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.set("photo", file);
                setSaved(false);
                setError(null);
                startTransition(async () => {
                  const res = await uploadPhoto(token, fd);
                  if (res.ok) set("photoUrl", res.url);
                  else setError(res.error);
                });
              }}
            />
            {pending && <p className="mt-1 text-xs text-neutral-500">Загружаем…</p>}
          </div>
        </div>
      </Field>
      <Field label="Подход" hint="Например: КПТ, гештальт-терапия">
        <Input value={form.approach} onChange={(e) => set("approach", e.target.value)} />
      </Field>
      <Field
        label="Ссылка на видеовстречу"
        hint="Постоянная комната в Телемосте, Zoom или другом сервисе. Её увидит только клиент, записавшийся к вам, — и только после брони"
      >
        <Input
          value={form.meetingUrl}
          onChange={(e) => set("meetingUrl", e.target.value)}
          placeholder="https://telemost.yandex.ru/..."
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Формат работы">
          <div className="flex gap-2">
            {FORMATS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => set("format", v)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm",
                  form.format === v
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                    : "border-neutral-200 hover:border-brand-400",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Стоимость сессии" hint="Например: 3500 ₽ / 50 минут">
          <Input value={form.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
      </div>
      <Field label="О себе" hint="2–3 абзаца: кто вы, с чем работаете, что для вас важно в терапии">
        <Textarea rows={5} value={form.about} onChange={(e) => set("about", e.target.value)} />
      </Field>
      <Field label="Темы, с которыми работаете">
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const active = form.topicSlugs.includes(t.slug);
            return (
              <button
                key={t.slug}
                type="button"
                onClick={() =>
                  set(
                    "topicSlugs",
                    active
                      ? form.topicSlugs.filter((s) => s !== t.slug)
                      : [...form.topicSlugs, t.slug],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-neutral-300 hover:border-brand-400",
                )}
              >
                {t.title}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Как проходят встречи" hint="Длительность, частота, как строится работа">
        <Textarea
          rows={3}
          value={form.howSessions}
          onChange={(e) => set("howSessions", e.target.value)}
        />
      </Field>
      <Field label="Мини-FAQ" hint="Частые вопросы клиентов и ваши ответы (до 3)">
        <div className="space-y-3">
          {form.faq.map((f, i) => (
            <div key={i} className="rounded-xl border p-3">
              <Input
                value={f.q}
                onChange={(e) =>
                  set(
                    "faq",
                    form.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)),
                  )
                }
                placeholder="Вопрос"
              />
              <Textarea
                rows={2}
                value={f.a}
                onChange={(e) =>
                  set(
                    "faq",
                    form.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)),
                  )
                }
                placeholder="Ответ"
                className="mt-2"
              />
            </div>
          ))}
          {form.faq.length < 3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("faq", [...form.faq, { q: "", a: "" }])}
            >
              + Добавить вопрос
            </Button>
          )}
        </div>
      </Field>
      <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        <strong>Первая встреча с новым клиентом — бесплатная.</strong> Это правило платформы: так
        человек понимает, подходите ли вы друг другу, и охотнее решается прийти. Платными будут все
        последующие сессии.
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-700">Сохранено ✓</p>}
      <Button size="lg" disabled={pending} onClick={submit}>
        {pending ? "Сохраняем…" : "Сохранить профиль"}
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
