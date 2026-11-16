"use client";

import PhoneInputBase, { type Value } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Не даём набрать лишние цифры. limitMaxLength библиотеки тут не помогает: код +7
 * общий у России и Казахстана, и на номере неверной длины она теряет страну.
 * +7 — ровно 10 цифр после кода, остальные страны — максимум E.164 (15 цифр).
 */
const maxDigits = (digits: string) => (digits.startsWith("7") ? 11 : 15);

function capPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > maxDigits(digits) ? `+${digits.slice(0, maxDigits(digits))}` : value;
}

// Поле в стиле Input сайта; страну выбирает родной select библиотеки.
const Field = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function Field(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      // Лишнюю цифру не пускаем в поле вовсе — и при наборе, и при вставке.
      onBeforeInput={(e) => {
        const data = (e.nativeEvent as InputEvent).data ?? "";
        const el = e.currentTarget;
        const selected = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0).replace(/\D/g, "").length;
        const current = el.value.replace(/\D/g, "");
        const next = current.length - selected + data.replace(/\D/g, "").length;
        if (next > maxDigits(current)) e.preventDefault();
        props.onBeforeInput?.(e);
      }}
      onPaste={(e) => {
        const el = e.currentTarget;
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
        const kept = el.value.replace(/\D/g, "").length -
          el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0).replace(/\D/g, "").length;
        // Вставили номер целиком (+7…, 8…) в пустое поле — берём его, иначе дописываем.
        const room = maxDigits(pasted.startsWith("7") || kept === 0 ? pasted : "7") - kept;
        if (pasted.length > room) {
          e.preventDefault();
          document.execCommand("insertText", false, pasted.slice(0, Math.max(room, 0)));
        }
        props.onPaste?.(e);
      }}
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 py-2 text-base outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
    />
  );
});

/**
 * Телефон с маской и выбором страны (react-phone-number-input — как в других
 * проектах). Значение — E.164 («+79001234567») или "" пока номер пустой.
 * Буквы ввести нельзя; корректность номера проверяет isValidPhone.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  invalid,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <PhoneInputBase
      id={id}
      international
      defaultCountry="RU"
      countryCallingCodeEditable={false}
      flags={flags}
      value={(value || undefined) as Value | undefined}
      onChange={(v) => onChange(capPhone(v ?? ""))}
      inputComponent={Field}
      aria-invalid={invalid || undefined}
      autoComplete="tel"
      className={cn("mipsy-phone flex items-center gap-2", className)}
    />
  );
}
