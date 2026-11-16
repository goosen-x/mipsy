"use client";

import { IconChevronDown, IconPlus, IconTrash } from "@tabler/icons-react";
import { useId } from "react";
import {
  EDUCATION_LEVELS,
  emptyCourse,
  emptyPlace,
  type EducationCourse,
  type EducationData,
  type EducationPlace,
} from "@/lib/education";
import { FloatingFrame, FloatingInput, SuggestField, type Suggestion } from "@/components/suggest-field";

async function suggest(params: Record<string, string>): Promise<Suggestion[]> {
  const res = await fetch(`/api/edu?${new URLSearchParams(params)}`);
  if (!res.ok) return [];
  return (await res.json()).items ?? [];
}

const toYear = (v: string) => (v.replace(/\D/g, "").slice(0, 4) ? Number(v.replace(/\D/g, "").slice(0, 4)) : null);

/** Образование по полям, как в резюме на hh.ru: места учёбы и курсы. */
export function EducationEditor({
  value,
  onChange,
}: {
  value: EducationData;
  onChange: (next: EducationData) => void;
}) {
  const setPlace = (i: number, patch: Partial<EducationPlace>) =>
    onChange({ ...value, places: value.places.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setCourse = (i: number, patch: Partial<EducationCourse>) =>
    onChange({ ...value, courses: value.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <div className="space-y-10">
      <div className="space-y-8">
        {value.places.map((place, i) => (
          <PlaceFields
            key={i}
            index={i}
            place={place}
            canRemove={value.places.length > 1}
            onChange={(patch) => setPlace(i, patch)}
            onRemove={() => onChange({ ...value, places: value.places.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...value, places: [...value.places, emptyPlace()] })}
          className="inline-flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800"
        >
          <IconPlus size={18} /> Добавить место учёбы
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Курсы и переподготовка</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Профессиональная переподготовка, обучение подходу, повышение квалификации. Часы важны
            для модерации: по ним видно, пройдено ли полное обучение подходу.
          </p>
        </div>
        {value.courses.map((course, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-neutral-100 p-4">
            <div className="flex items-start gap-2">
              <FloatingInput
                label="Название программы или курса"
                value={course.name}
                onChange={(v) => setCourse(i, { name: v })}
                className="flex-1"
              />
              <RemoveButton
                onClick={() => onChange({ ...value, courses: value.courses.filter((_, j) => j !== i) })}
              />
            </div>
            <FloatingInput
              label="Организация"
              value={course.organization}
              onChange={(v) => setCourse(i, { organization: v })}
            />
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <FloatingInput
                label="Часов"
                inputMode="numeric"
                value={course.hours?.toString() ?? ""}
                onChange={(v) => setCourse(i, { hours: v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "").slice(0, 5)) : null })}
              />
              <FloatingInput
                label="Год окончания"
                inputMode="numeric"
                value={course.year?.toString() ?? ""}
                onChange={(v) => setCourse(i, { year: toYear(v) })}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...value, courses: [...value.courses, emptyCourse()] })}
          className="inline-flex items-center gap-2 font-medium text-brand-700 hover:text-brand-800"
        >
          <IconPlus size={18} /> Добавить курс
        </button>
      </div>
    </div>
  );
}

function PlaceFields({
  index,
  place,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  place: EducationPlace;
  canRemove: boolean;
  onChange: (patch: Partial<EducationPlace>) => void;
  onRemove: () => void;
}) {
  const levelId = useId();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{index === 0 ? "Место учёбы" : `Место учёбы ${index + 1}`}</h3>
        {canRemove && <RemoveButton onClick={onRemove} />}
      </div>

      <FloatingFrame
        label="Уровень образования"
        htmlFor={levelId}
        focused={false}
        filled
        trailing={<IconChevronDown size={20} className="pointer-events-none text-neutral-400" />}
      >
        <select
          id={levelId}
          value={place.level}
          onChange={(e) => onChange({ level: e.target.value })}
          className="w-full cursor-pointer appearance-none bg-transparent text-base outline-none"
        >
          {EDUCATION_LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </FloatingFrame>

      <div className="pt-2 text-sm text-neutral-500">Учебное заведение</div>
      <SuggestField
        label="Название учебного заведения"
        value={place.institution}
        // Сменили вуз — факультет от прежнего уже не подходит.
        onChange={(v, id) =>
          onChange({ institution: v, institutionId: id, ...(id !== place.institutionId ? { faculty: "" } : {}) })
        }
        load={(text) => suggest({ kind: "institutions", text })}
      />
      <SuggestField
        label="Факультет"
        value={place.faculty}
        onChange={(v) => onChange({ faculty: v })}
        // Факультеты знает только справочник вуза: без выбранного вуза — просто текст.
        minChars={place.institutionId ? 0 : 99}
        load={async (text) => {
          if (!place.institutionId) return [];
          const all = await suggest({ kind: "faculties", id: place.institutionId });
          const q = text.toLowerCase();
          return q ? all.filter((f) => f.title.toLowerCase().includes(q)) : all;
        }}
      />
      <SuggestField
        label="Специализация"
        value={place.specialization}
        onChange={(v) => onChange({ specialization: v })}
        load={(text) => suggest({ kind: "fields", text })}
      />
      <div className="flex flex-wrap items-center gap-4">
        <FloatingInput
          label="Год окончания"
          inputMode="numeric"
          value={place.year?.toString() ?? ""}
          onChange={(v) => onChange({ year: toYear(v) })}
          className="w-44"
        />
        <span className="text-sm text-neutral-500">
          Если ещё учитесь, укажите год предполагаемого окончания
        </span>
      </div>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Удалить"
      onClick={onClick}
      className="rounded-xl p-3 text-neutral-400 hover:bg-red-50 hover:text-red-600"
    >
      <IconTrash size={20} />
    </button>
  );
}
