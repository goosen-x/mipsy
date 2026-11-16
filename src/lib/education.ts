/**
 * Образование психолога — по полям, как в резюме на hh.ru. Подсказки вузов,
 * факультетов и специальностей идут из открытого API hh (через /api/edu).
 * Чистые функции: одни и те же в форме кабинета, server action и тестах.
 */

export const EDUCATION_LEVELS = [
  "Среднее специальное",
  "Неоконченное высшее",
  "Высшее",
  "Бакалавр",
  "Магистр",
  "Кандидат наук",
  "Доктор наук",
] as const;

export type EducationPlace = {
  level: string;
  institution: string;
  /** id вуза в справочнике hh — по нему подсказываются факультеты. */
  institutionId?: string | null;
  faculty: string;
  specialization: string;
  year: number | null;
};

export type EducationCourse = {
  name: string;
  organization: string;
  hours: number | null;
  year: number | null;
};

export type EducationData = { places: EducationPlace[]; courses: EducationCourse[] };

export const emptyPlace = (): EducationPlace => ({
  level: "Высшее",
  institution: "",
  institutionId: null,
  faculty: "",
  specialization: "",
  year: null,
});

export const emptyCourse = (): EducationCourse => ({ name: "", organization: "", hours: null, year: null });

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function year(v: unknown, now: Date): number | null {
  const n = Number(v);
  // Ещё учится — год окончания может быть в будущем, но не дальше 7 лет.
  return Number.isInteger(n) && n >= 1950 && n <= now.getFullYear() + 7 ? n : null;
}

/**
 * Приводит присланное формой к безопасному виду: обрезает строки, выбрасывает
 * пустые записи и мусор. Ошибка — только если нет ни одного места учёбы с вузом.
 */
export function cleanEducation(
  raw: unknown,
  now: Date = new Date(),
): { ok: true; data: EducationData } | { ok: false; error: string } {
  const input = (raw ?? {}) as { places?: unknown; courses?: unknown };
  const places = (Array.isArray(input.places) ? input.places : [])
    .slice(0, 10)
    .map((p: Record<string, unknown>): EducationPlace => ({
      level: (EDUCATION_LEVELS as readonly string[]).includes(str(p?.level)) ? str(p?.level) : "Высшее",
      institution: str(p?.institution),
      institutionId: /^\d{1,12}$/.test(str(p?.institutionId)) ? str(p?.institutionId) : null,
      faculty: str(p?.faculty),
      specialization: str(p?.specialization),
      year: year(p?.year, now),
    }))
    .filter((p) => p.institution);
  const courses = (Array.isArray(input.courses) ? input.courses : [])
    .slice(0, 20)
    .map((c: Record<string, unknown>): EducationCourse => {
      const hours = Number(c?.hours);
      return {
        name: str(c?.name),
        organization: str(c?.organization),
        hours: Number.isInteger(hours) && hours > 0 && hours <= 10000 ? hours : null,
        year: year(c?.year, now),
      };
    })
    .filter((c) => c.name);

  if (places.length === 0) return { ok: false, error: "Добавьте хотя бы одно место учёбы" };
  return { ok: true, data: { places, courses } };
}

/** Текстовая версия для публичного профиля, поиска каталога и админки. */
export function educationText(data: EducationData): string {
  const lines = data.places.map((p) =>
    [
      p.institution,
      [p.faculty, p.specialization].filter(Boolean).join(", "),
      [p.level, p.year].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(" — "),
  );
  if (data.courses.length) {
    lines.push(
      ...data.courses.map((c) =>
        [
          c.name,
          c.organization,
          [c.hours ? `${c.hours} ч` : null, c.year].filter(Boolean).join(", "),
        ]
          .filter(Boolean)
          .join(" — "),
      ),
    );
  }
  return lines.join("\n");
}
