"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type Suggestion = { id: string | null; title: string; hint?: string };

/** Рамка поля с подписью внутри, как на hh.ru: мелкая подпись сверху, значение под ней. */
export function FloatingFrame({
  label,
  htmlFor,
  focused,
  filled,
  children,
  trailing,
  className,
}: {
  label: string;
  htmlFor: string;
  focused: boolean;
  filled: boolean;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const raised = focused || filled;
  return (
    <div
      className={cn(
        "relative flex h-14 items-center rounded-xl border bg-white px-3.5 transition-[border-color,box-shadow] duration-200",
        focused ? "border-brand-500 ring-3 ring-brand-200/60" : "border-neutral-200 hover:border-neutral-300",
        className,
      )}
    >
      <label
        htmlFor={htmlFor}
        className={cn(
          "pointer-events-none absolute left-3.5 text-neutral-500 transition-all duration-150",
          raised ? "top-2 text-xs" : "top-1/2 -translate-y-1/2 text-base",
        )}
      >
        {label}
      </label>
      <div className={cn("min-w-0 flex-1", raised ? "pt-4" : "")}>{children}</div>
      {trailing}
    </div>
  );
}

/** Обычное текстовое/числовое поле с плавающей подписью. */
export function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <FloatingFrame label={label} htmlFor={id} focused={focused} filled={value !== ""} className={className}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent text-base outline-none"
      />
    </FloatingFrame>
  );
}

/**
 * Поле с подсказками из справочника (вузы, факультеты, специальности).
 * Значение — свободный текст: если нужного варианта нет в справочнике, человек
 * просто дописывает своё. Выбор из списка дополнительно отдаёт id записи.
 */
export function SuggestField({
  label,
  value,
  onChange,
  load,
  minChars = 2,
  disabled,
}: {
  label: string;
  value: string;
  /** id — только при выборе из подсказок; при ручном вводе null. */
  onChange: (value: string, id: string | null) => void;
  /** Загрузка подсказок по введённому тексту. */
  load: (text: string) => Promise<Suggestion[]>;
  /** Сколько символов нужно для поиска; 0 — показывать список сразу (факультеты). */
  minChars?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Подсказки с задержкой: не дёргаем справочник на каждую букву.
  useEffect(() => {
    if (!focused) return;
    if (value.trim().length < minChars) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await loadRef.current(value.trim()).catch(() => []);
      if (!cancelled) {
        setItems(found);
        setActive(-1);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, focused, minChars]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(s: Suggestion) {
    onChange(s.title, s.id);
    setOpen(false);
    setItems([]);
  }

  const showList = open && focused && items.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <FloatingFrame
        label={label}
        htmlFor={id}
        focused={focused}
        filled={value !== ""}
        className={disabled ? "opacity-50" : undefined}
        trailing={
          value && !disabled ? (
            <button
              type="button"
              aria-label="Очистить"
              onClick={() => onChange("", null)}
              className="ml-2 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <IconX size={20} />
            </button>
          ) : null
        }
      >
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(e) => {
            onChange(e.target.value, null);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full bg-transparent text-base outline-none"
        />
      </FloatingFrame>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-neutral-100 bg-white py-2 shadow-xl"
        >
          {items.map((s, i) => (
            <li
              key={`${s.id ?? s.title}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, а не click: иначе поле теряет фокус и список закрывается раньше.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-5 py-3", i === active && "bg-brand-50")}
            >
              <div className="text-base text-neutral-900">{s.title}</div>
              {s.hint && <div className="mt-0.5 text-sm text-neutral-500">{s.hint}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
