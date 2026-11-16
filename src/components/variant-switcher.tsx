import Link from "next/link";

/** Плавающий переключатель вариантов дизайна (?v=N) — для выбора, клиентам не виден. */
export function VariantSwitcher({
  current,
  variants,
  basePath,
  positionClass = "bottom-4",
  title = "Вариант",
  inline = false,
}: {
  current: number;
  variants: readonly { n: number; label: string }[];
  /** Страница, на которой переключаем: /me, /cab… */
  basePath: string;
  /** Где прижать плашку: когда на странице два переключателя, второй поднимаем. */
  positionClass?: string;
  title?: string;
  /** Без собственного позиционирования — когда плашки собраны в общий блок. */
  inline?: boolean;
}) {
  return (
    <nav
      aria-label="Варианты страницы"
      className={`${inline ? "" : `fixed inset-x-0 ${positionClass} z-50 mx-auto`} flex w-fit max-w-[calc(100%-2rem)] items-center gap-1 overflow-x-auto rounded-2xl bg-neutral-900/90 p-1.5 text-sm text-white shadow-lg backdrop-blur`}
    >
      <span className="px-2 text-white/60">{title}</span>
      {variants.map((v) => (
        <Link
          key={v.n}
          href={`${basePath}?v=${v.n}`}
          scroll={false}
          title={v.label}
          className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 transition-colors ${v.n === current ? "bg-white font-medium text-neutral-900" : "hover:bg-white/15"}`}
        >
          {v.n} · {v.label}
        </Link>
      ))}
    </nav>
  );
}
