// Человекочитаемые подписи для значений анкеты и статусов.
export const FREQ_LABELS: Record<string, string> = {
  never: "Никогда",
  seldom: "Редко",
  monthly: "Несколько раз в месяц",
  weekly: "Несколько раз в неделю",
  daily: "Каждый день",
};

export const PROBLEM_LABELS: Record<string, string> = {
  anxiety: "Тревога, страхи",
  depression: "Подавленность, депрессия",
  "self-esteem": "Самооценка",
  relationships: "Отношения",
  burnout: "Выгорание",
  loss: "Утрата",
  childhood: "Детский опыт, травма",
  other: "Другое",
};

export const LIFE_IMPACT_LABELS: Record<string, string> = {
  none: "Почти не мешает",
  some: "Немного мешает",
  strong: "Сильно мешает",
  unbearable: "Невыносимо мешает",
};

export const GENDER_LABELS: Record<string, string> = {
  female: "Женщина",
  male: "Мужчина",
  skip: "Не указан",
};

export const THERAPY_EXP_LABELS: Record<string, string> = {
  none: "Впервые",
  short: "Была, короткая",
  long: "Была, длительная",
};

export const PREF_GENDER_LABELS: Record<string, string> = {
  woman: "Женщина",
  man: "Мужчина",
  any: "Не важно",
};

export const PREF_AGE_LABELS: Record<string, string> = {
  under40: "До 40 лет",
  over40: "От 40 лет",
  any: "Не важно",
};

export const TIME_LABELS: Record<string, string> = {
  morning: "Утро",
  day: "День",
  evening: "Вечер",
  weekend: "Выходные",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  called: "Позвонили",
  matched: "Подобран",
  rematch: "Нужен переподбор",
  rejected: "Отказ",
};

export const MODERATION_STATUS_LABELS: Record<string, string> = {
  new: "На модерации",
  approved: "Одобрен",
  rejected: "Отклонён",
};

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}
