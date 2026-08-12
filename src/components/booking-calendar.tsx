"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarSlot = {
  id: number;
  startsAt: string; // "YYYY-MM-DDTHH:mm"
  durationMin: number;
  isIntroCall: boolean;
};

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
/** Понедельник — первый столбец. */
function weekdayIndex(y: number, m: number, d: number) {
  return (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
}

/**
 * Календарь записи по образцу SmartMental: сетка месяца, дни без свободных окон
 * погашены, время выбранного дня — в панели справа.
 */
export function BookingCalendar({
  slots,
  onBook,
  timezoneNote = "по вашему времени",
}: {
  slots: CalendarSlot[];
  onBook: (slotId: number) => Promise<{ ok: boolean; error?: string }>;
  timezoneNote?: string;
}) {
  const today = new Date();
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarSlot[]>();
    for (const s of slots) {
      const day = s.startsAt.split("T")[0];
      map.set(day, [...(map.get(day) ?? []), s]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [slots]);

  const firstAvailable = [...byDate.keys()].sort()[0];
  const [view, setView] = useState(() => {
    const base = firstAvailable ? firstAvailable.split("-").map(Number) : null;
    return base
      ? { year: base[0], month: base[1] - 1 }
      : { year: today.getFullYear(), month: today.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(firstAvailable ?? null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const offset = weekdayIndex(view.year, view.month, 1);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate());
  const canGoBack =
    view.year > today.getFullYear() ||
    (view.year === today.getFullYear() && view.month > today.getMonth());

  const shift = (delta: number) => {
    const m = view.month + delta;
    setView({ year: view.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 });
  };

  const daySlots = selectedDay ? (byDate.get(selectedDay) ?? []) : [];

  return (
    <div>
      <p className="mb-3 text-sm text-accent-600 sm:hidden">
        Бронь можно отменить не позднее чем за 24 часа до начала встречи.
      </p>
      <div className="flex flex-col gap-4 rounded-2xl border p-3 sm:flex-row">
        {/* Сетка месяца */}
        <div className="sm:w-72">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              disabled={!canGoBack}
              className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Предыдущий месяц"
            >
              ←
            </button>
            <span className="text-sm font-medium capitalize">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
              aria-label="Следующий месяц"
            >
              →
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-medium uppercase text-accent-500">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const date = ymd(view.year, view.month, day);
              const has = byDate.has(date);
              const isToday = date === todayStr;
              const isSelected = date === selectedDay;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!has}
                  title={has ? "Есть свободное время" : "Нет свободного времени"}
                  onClick={() => {
                    setSelectedDay(date);
                    setSelectedSlot(null);
                    setError(null);
                  }}
                  className={cn(
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                    !has && "text-neutral-300",
                    has && !isSelected && "font-medium hover:bg-accent-400/40",
                    isSelected && "bg-accent-500 font-medium text-white",
                    isToday && !isSelected && "text-accent-600",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Время выбранного дня */}
        <div className="flex-1 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="text-sm font-medium">Время встречи</div>
          <div className="text-xs text-neutral-500">{timezoneNote}</div>
          {daySlots.length === 0 ? (
            <p className="mt-4 text-xs text-neutral-500">
              Нажмите на подсвеченную дату, чтобы увидеть свободное время.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {daySlots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(s.id);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    selectedSlot === s.id
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-neutral-200 hover:border-brand-400",
                  )}
                >
                  {s.startsAt.split("T")[1]}
                  {s.isIntroCall && (
                    <span
                      className={cn(
                        "ml-1 text-xs",
                        selectedSlot === s.id ? "text-brand-100" : "text-brand-700",
                      )}
                    >
                      знакомство
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 hidden text-xs text-neutral-500 sm:block">
        Бронь можно отменить не позднее чем за 24 часа до начала встречи.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Button
        className="mt-4 rounded-lg bg-accent-500 px-8 hover:bg-accent-600"
        size="lg"
        disabled={pending || selectedSlot === null}
        onClick={() =>
          startTransition(async () => {
            if (selectedSlot === null) return;
            const res = await onBook(selectedSlot);
            if (!res.ok) setError(res.error ?? "Не получилось записаться");
            else setSelectedSlot(null);
          })
        }
      >
        {pending ? "Бронируем…" : "Забронировать"}
      </Button>
    </div>
  );
}
