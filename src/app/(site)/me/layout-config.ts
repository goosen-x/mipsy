import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canSwitchVariants } from "./data";

/**
 * Варианты устройства кабинета клиента — на выбор. Переключатель видят админы
 * и локальная разработка; клиенты получают вариант по умолчанию. Выбор живёт
 * в `?layout=N` и запоминается в куке, чтобы не сбрасываться между разделами.
 * После выбора лишние варианты удалить.
 */
export const LAYOUT_VARIANTS = [
  { n: 1, label: "Вкладки" },
  { n: 2, label: "Боковое меню" },
  { n: 3, label: "Плитки" },
  { n: 4, label: "Одна страница" },
  { n: 5, label: "Приложение" },
] as const;

export const DEFAULT_LAYOUT = 1;
export const LAYOUT_COOKIE = "me_layout";

export type CabinetLayout = 1 | 2 | 3 | 4 | 5;

export async function resolveLayout(
  searchParams: Promise<{ layout?: string }>,
): Promise<{ layout: CabinetLayout; canSwitch: boolean }> {
  const canSwitch = await canSwitchVariants();
  if (!canSwitch) return { layout: DEFAULT_LAYOUT, canSwitch };
  const fromQuery = Number((await searchParams).layout);
  const fromCookie = Number((await cookies()).get(LAYOUT_COOKIE)?.value);
  const n = fromQuery || fromCookie;
  return { layout: (n >= 1 && n <= 5 ? n : DEFAULT_LAYOUT) as CabinetLayout, canSwitch };
}

/** Разделы в варианте «Одна страница» живут якорями на /me. */
export function onePageRedirect(section: string, v?: string): never {
  redirect(`/me${v ? `?v=${v}` : ""}#${section}`);
}
