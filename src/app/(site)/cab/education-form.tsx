"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitEducation } from "./actions";
import { EducationEditor } from "./education-editor";
import type { EducationData } from "@/lib/education";
import { uploadEducationDoc } from "@/app/(wizard)/psy/upload";

type Doc = { url: string; name: string };

/** Дозаполнение образования и документов после короткой регистрации.
 * Пока черновик не отправлен, заявку не видит модерация. */
export function EducationForm({
  initial,
  submitsForReview,
}: {
  /** legacyText — образование, введённое раньше одним текстом: показываем как подсказку. */
  initial: { education: EducationData; legacyText: string | null; docs: Doc[] };
  /** Черновик или отклонённая заявка: сохранение отправляет её на модерацию. */
  submitsForReview: boolean;
}) {
  const [education, setEducation] = useState<EducationData>(initial.education);
  const [docs, setDocs] = useState<Doc[]>(initial.docs);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await submitEducation({ education, educationDocs: docs.map((d) => d.url) });
      if (res.ok) {
        setSaved(true);
        toast.success(submitsForReview ? "Заявка отправлена на модерацию" : "Сохранено");
      } else {
        setError(res.error ?? "Не получилось сохранить");
      }
    });
  }

  return (
    <div className="space-y-5">
      {initial.legacyText && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Раньше вы указали образование одним текстом:</div>
          <p className="mt-1 whitespace-pre-line">{initial.legacyText}</p>
          <p className="mt-2">Перенесите его в поля ниже — так модерации проще проверить документы.</p>
        </div>
      )}
      <EducationEditor
        value={education}
        onChange={(next) => {
          setEducation(next);
          setSaved(false);
        }}
      />

      <div>
        <Label className="mb-1 block">Документы об образовании</Label>
        {docs.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">
            {docs.map((d) => (
              <li key={d.url} className="flex items-center gap-2">
                <a href={d.url} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                  {d.name}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setDocs(docs.filter((x) => x.url !== d.url));
                    setSaved(false);
                  }}
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
              if (res.ok) {
                setDocs((prev) => [...prev, { url: res.url, name: res.name }]);
                setSaved(false);
              } else setError(res.error);
            });
          }}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Нужны сканы дипломов и сертификатов, а не фото с телефона: документ целиком, без
          бликов и теней, весь текст читается. PDF, JPG или PNG до 10 МБ. Сканы видит только
          модерация.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-700">Сохранено ✓</p>}
      <Button size="lg" disabled={pending} onClick={submit}>
        {pending ? "Сохраняем…" : submitsForReview ? "Отправить на модерацию" : "Сохранить"}
      </Button>
    </div>
  );
}
