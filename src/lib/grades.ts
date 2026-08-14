/**
 * Грейды психологов. Стоимость сессии на платформе фиксированная и зависит
 * только от грейда — психолог цену не выбирает. Грейд присваивает админ на
 * модерации, вместе с одобрением. Цены меняются здесь и нигде больше.
 */

export const GRADES = {
  1: { title: "Базовый", price: 2500 },
  2: { title: "Опытный", price: 3500 },
  3: { title: "Ведущий", price: 5000 },
} as const;

export type Grade = keyof typeof GRADES; // 1 | 2 | 3

export function isGrade(value: unknown): value is Grade {
  return value === 1 || value === 2 || value === 3;
}

/** «3 500 ₽» — цена сессии по грейду; null, если грейд ещё не присвоен. */
export function gradePriceLabel(grade: number | null | undefined): string | null {
  if (!isGrade(grade)) return null;
  return `${GRADES[grade].price.toLocaleString("ru-RU")} ₽`;
}

export function gradeTitle(grade: number | null | undefined): string | null {
  return isGrade(grade) ? GRADES[grade].title : null;
}
