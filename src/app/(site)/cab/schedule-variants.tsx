"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addDays,
  DAY_END_MIN,
  DAY_START_MIN,
  minutesOfDay,
  mondayOf,
  overlapsAny,
  repeatWeeks,
  SESSION_TYPES,
  sessionLabel,
  sessionsFromTemplate,
  STEP_MIN,
  timeOf,
  type Interval,
  type WeekTemplate,
} from "@/lib/schedule";
import { saveSchedule } from "./actions";

/** Слот кабинета — то, что приходит со страницы. */
export type CabSlot = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: string;
  clientName: string | null;
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAYS_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const todayMsk = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
const nowMskStr = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16);
const dayLabel = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
const isFree = (s: CabSlot) => s.status === "free";
const isBooked = (s: CabSlot) => s.status === "booked";

/** Общий хук: сохранить пакет изменений и показать итог. */
function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = (open: Interval[], closeIds: number[], done?: () => void) =>
    startTransition(async () => {
      const res = await saveSchedule({ open, closeIds });
      if (!res.ok) {
        toast.error(res.error ?? "Не получилось сохранить");
        return;
      }
      const parts = [
        res.added ? `открыто ${res.added}` : null,
        res.removed ? `закрыто ${res.removed}` : null,
        res.skipped ? `пропущено ${res.skipped} — пересекаются с другими сессиями или в прошлом` : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Расписание: ${parts.join(", ")}` : "Изменений нет");
      done?.();
      router.refresh();
    });
  return { save, pending };
}

function TypePicker({ value, onChange, compact }: { value: number; onChange: (m: number) => void; compact?: boolean }) {
  return (
    <div className="inline-flex rounded-xl bg-neutral-100 p-1 text-sm">
      {SESSION_TYPES.map((t) => (
        <button
          key={t.minutes}
          type="button"
          onClick={() => onChange(t.minutes)}
          className={cn(
            "rounded-lg px-3 py-1.5 transition-colors",
            value === t.minutes ? "bg-white font-medium text-brand-800 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
          )}
        >
          {compact ? t.short : t.label} · {t.minutes} мин
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-brand-100 ring-1 ring-brand-300" /> свободно
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-brand-600" /> записан клиент
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300" /> парная
      </span>
    </div>
  );
}

/* =====================================================================
   1. Сетка недели — клик по пустому месту ставит сессию, по свободной — убирает
   ===================================================================== */

const ROW_H = 22; // px на 30 минут

export function WeekGridEditor({ slots }: { slots: CabSlot[] }) {
  const { save, pending } = useSave();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayMsk()));
  const [minutes, setMinutes] = useState(50);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekSlots = slots.filter((s) => s.startsAt >= `${days[0]}T00:00` && s.startsAt <= `${days[6]}T23:59`);
  const rows = (DAY_END_MIN - DAY_START_MIN) / STEP_MIN;
  const now = nowMskStr();

  function clickCell(date: string, minute: number) {
    const candidate = { startsAt: `${date}T${timeOf(minute)}`, durationMin: minutes };
    if (candidate.startsAt < now) return toast.info("Это время уже прошло");
    if (minute + minutes > DAY_END_MIN) return toast.info("Сессия не помещается до 22:00");
    if (overlapsAny(candidate, slots)) return toast.info("Пересекается с другой сессией");
    save([candidate], []);
  }

  function repeat(weeks: number) {
    const pattern = weekSlots.filter((s) => isFree(s) || isBooked(s)).map((s) => ({ startsAt: s.startsAt, durationMin: s.durationMin }));
    if (!pattern.length) return toast.info("На этой неделе пока нет сессий — сначала расставьте их");
    save(repeatWeeks(pattern, weeks), []);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Предыдущая неделя">
            <IconChevronLeft size={18} />
          </Button>
          <div className="min-w-44 text-center font-medium">
            {dayLabel(days[0])} — {dayLabel(days[6])}
          </div>
          <Button variant="outline" size="icon-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Следующая неделя">
            <IconChevronRight size={18} />
          </Button>
        </div>
        <TypePicker value={minutes} onChange={setMinutes} />
      </div>
      <Legend />

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div />
          {days.map((d, i) => (
            <div key={d} className={cn("border-l border-neutral-100 py-2 text-center text-sm", d === todayMsk() && "font-semibold text-brand-700")}>
              {WEEKDAYS[i]} {Number(d.slice(8, 10))}
            </div>
          ))}
          <div className="relative" style={{ height: rows * ROW_H }}>
            {Array.from({ length: rows / 2 }, (_, h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-neutral-400" style={{ top: h * 2 * ROW_H }}>
                {timeOf(DAY_START_MIN + h * 60)}
              </div>
            ))}
          </div>
          {days.map((date) => (
            <div key={date} className="relative border-l border-neutral-100" style={{ height: rows * ROW_H }}>
              {Array.from({ length: rows }, (_, r) => (
                <button
                  key={r}
                  type="button"
                  disabled={pending}
                  onClick={() => clickCell(date, DAY_START_MIN + r * STEP_MIN)}
                  aria-label={`${date} ${timeOf(DAY_START_MIN + r * STEP_MIN)}`}
                  className={cn(
                    "absolute inset-x-0 hover:bg-brand-50",
                    r % 2 === 0 ? "border-t border-neutral-100" : "border-t border-dashed border-neutral-50",
                  )}
                  style={{ top: r * ROW_H, height: ROW_H }}
                />
              ))}
              {weekSlots
                .filter((s) => s.startsAt.startsWith(date))
                .map((s) => {
                  const top = ((minutesOfDay(s.startsAt) - DAY_START_MIN) / STEP_MIN) * ROW_H;
                  const height = (s.durationMin / STEP_MIN) * ROW_H;
                  const pair = s.durationMin >= 90;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={pending || !isFree(s)}
                      onClick={() => save([], [s.id])}
                      title={isFree(s) ? "Нажмите, чтобы закрыть окно" : s.clientName ? `Записан: ${s.clientName}` : "Прошедшая сессия"}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight",
                        isBooked(s)
                          ? "cursor-default bg-brand-600 text-white"
                          : !isFree(s)
                            ? "cursor-default bg-neutral-200 text-neutral-500"
                            : pair
                              ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-red-50 hover:text-red-700 hover:ring-red-300"
                              : "bg-brand-100 text-brand-900 ring-1 ring-brand-300 hover:bg-red-50 hover:text-red-700 hover:ring-red-300",
                      )}
                      style={{ top: top + 1, height: height - 2 }}
                    >
                      <div className="font-medium">{s.startsAt.slice(11)}</div>
                      <div className="truncate">{isBooked(s) ? s.clientName ?? "Клиент" : sessionLabel(s.durationMin)}</div>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-600">Повторить эту неделю на:</span>
        {[
          [1, "1 неделю"],
          [2, "2 недели"],
          [4, "месяц"],
        ].map(([w, label]) => (
          <Button key={w} variant="outline" size="sm" disabled={pending} onClick={() => repeat(w as number)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* =====================================================================
   2. Рабочие часы + период — как в Calendly: шаблон недели нарезается сессиями
   ===================================================================== */

type Range = { from: string; to: string; minutes: number };
const TIME_CHOICES = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / STEP_MIN + 1 }, (_, i) => timeOf(DAY_START_MIN + i * STEP_MIN));

export function WorkingHoursEditor({ slots }: { slots: CabSlot[] }) {
  const { save, pending } = useSave();
  const [template, setTemplate] = useState<Record<number, Range[]>>({
    0: [{ from: "10:00", to: "14:00", minutes: 50 }],
    1: [],
    2: [{ from: "18:00", to: "21:00", minutes: 90 }],
    3: [{ from: "10:00", to: "14:00", minutes: 50 }],
    4: [],
    5: [],
    6: [],
  });
  const [startDate, setStartDate] = useState(() => addDays(mondayOf(todayMsk()), 7));
  const [period, setPeriod] = useState(7);
  const [breakMin, setBreakMin] = useState(10);
  const [vacation, setVacation] = useState({ from: todayMsk(), to: addDays(todayMsk(), 7) });

  const planned = useMemo(
    () => sessionsFromTemplate(template as WeekTemplate, { startDate, days: period, breakMin }),
    [template, startDate, period, breakMin],
  );
  const now = nowMskStr();
  const fresh = planned.filter((s) => s.startsAt >= now && !overlapsAny(s, slots));
  const pairCount = fresh.filter((s) => s.durationMin >= 90).length;

  const setDay = (d: number, ranges: Range[]) => setTemplate({ ...template, [d]: ranges });
  const freeInVacation = slots.filter(
    (s) => isFree(s) && s.startsAt >= `${vacation.from}T00:00` && s.startsAt <= `${vacation.to}T23:59`,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="font-semibold">Рабочие часы по дням недели</h3>
        <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {WEEKDAYS_FULL.map((name, d) => {
            const ranges = template[d] ?? [];
            return (
              <div key={d} className="flex flex-wrap items-start gap-4 p-4">
                <label className="flex w-36 items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={ranges.length > 0}
                    onChange={(e) => setDay(d, e.target.checked ? [{ from: "10:00", to: "14:00", minutes: 50 }] : [])}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span className={ranges.length ? "font-medium" : "text-neutral-400"}>{name}</span>
                </label>
                <div className="flex-1 space-y-2">
                  {ranges.length === 0 && <div className="pt-2 text-sm text-neutral-400">Не работаю</div>}
                  {ranges.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <TimeSelect value={r.from} onChange={(v) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, from: v } : x)))} />
                      <span className="text-neutral-400">—</span>
                      <TimeSelect value={r.to} onChange={(v) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, to: v } : x)))} />
                      <select
                        value={r.minutes}
                        onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))}
                        className="h-9 rounded-lg border border-neutral-200 px-2 text-sm"
                      >
                        {SESSION_TYPES.map((t) => (
                          <option key={t.minutes} value={t.minutes}>
                            {t.label}, {t.minutes} мин
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Убрать промежуток"
                        onClick={() => setDay(d, ranges.filter((_, j) => j !== i))}
                        className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  ))}
                  {ranges.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDay(d, [...ranges, { from: "18:00", to: "21:00", minutes: 50 }])}
                      className="inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-800"
                    >
                      <IconPlus size={14} /> промежуток
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl bg-brand-50/60 p-5 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-neutral-600">С какой даты</span>
          <input
            type="date"
            value={startDate}
            min={todayMsk()}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-600">На какой срок</span>
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="mt-1 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-2">
            <option value={7}>1 неделя</option>
            <option value={14}>2 недели</option>
            <option value={28}>Месяц (4 недели)</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-neutral-600">Перерыв между сессиями</span>
          <select value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} className="mt-1 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-2">
            {[0, 10, 15, 30].map((b) => (
              <option key={b} value={b}>
                {b ? `${b} мин` : "без перерыва"}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
          <div className="text-sm text-neutral-700">
            Получится <b>{fresh.length}</b> {fresh.length === 1 ? "сессия" : "сессий"}
            {pairCount ? `, из них парных — ${pairCount}` : ""}.
            {planned.length > fresh.length && (
              <span className="text-neutral-500"> {planned.length - fresh.length} пропустим: прошлое время или уже занято.</span>
            )}
          </div>
          <Button disabled={pending || fresh.length === 0} onClick={() => save(fresh, [])}>
            Открыть {fresh.length || ""} окон
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-neutral-200 p-5">
        <h3 className="font-semibold">Закрыть период — отпуск, болезнь</h3>
        <p className="text-sm text-neutral-500">Свободные окна в эти даты снимутся. Записи клиентов останутся — их переносит оператор.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-neutral-600">С</span>
            <input type="date" value={vacation.from} onChange={(e) => setVacation({ ...vacation, from: e.target.value })} className="mt-1 block h-10 rounded-lg border border-neutral-200 px-2" />
          </label>
          <label className="text-sm">
            <span className="text-neutral-600">По</span>
            <input type="date" value={vacation.to} onChange={(e) => setVacation({ ...vacation, to: e.target.value })} className="mt-1 block h-10 rounded-lg border border-neutral-200 px-2" />
          </label>
          <Button variant="outline" disabled={pending || freeInVacation.length === 0} onClick={() => save([], freeInVacation.map((s) => s.id))}>
            Закрыть {freeInVacation.length} {freeInVacation.length === 1 ? "окно" : "окон"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-neutral-200 px-2 text-sm">
      {TIME_CHOICES.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
  );
}

/* =====================================================================
   3. Месяц + день — календарь с отметками, день настраивается и копируется
   ===================================================================== */

export function MonthDayEditor({ slots }: { slots: CabSlot[] }) {
  const { save, pending } = useSave();
  const [month, setMonth] = useState(() => todayMsk().slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState(() => todayMsk());
  const [copyMode, setCopyMode] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState(50);

  const first = `${month}-01`;
  const gridStart = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const daySlots = (d: string) => slots.filter((s) => s.startsAt.startsWith(d));
  const selectedSlots = daySlots(selected);
  const today = todayMsk();

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  }

  function add() {
    const candidate = { startsAt: `${selected}T${time}`, durationMin: minutes };
    if (overlapsAny(candidate, slots)) return toast.info("Пересекается с другой сессией этого дня");
    save([candidate], []);
  }

  function applyCopy() {
    const pattern = selectedSlots.filter((s) => isFree(s) || isBooked(s));
    const open = copyTargets.flatMap((d) => pattern.map((s) => ({ startsAt: `${d}T${s.startsAt.slice(11)}`, durationMin: s.durationMin })));
    save(open, [], () => {
      setCopyMode(false);
      setCopyTargets([]);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
            <IconChevronLeft size={18} />
          </Button>
          <div className="font-medium">
            {MONTHS_NOM[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </div>
          <Button variant="outline" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
            <IconChevronRight size={18} />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase text-brand-600">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const list = daySlots(d);
            const free = list.filter(isFree).length;
            const booked = list.filter(isBooked).length;
            const inMonth = d.startsWith(month);
            const isTarget = copyTargets.includes(d);
            const past = d < today;
            return (
              <button
                key={d}
                type="button"
                disabled={copyMode && (past || d === selected)}
                onClick={() =>
                  copyMode
                    ? setCopyTargets(isTarget ? copyTargets.filter((x) => x !== d) : [...copyTargets, d])
                    : setSelected(d)
                }
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-sm transition-colors",
                  !inMonth && "opacity-40",
                  past && "text-neutral-400",
                  d === selected && !copyMode ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-neutral-50",
                  isTarget && "border-brand-600 bg-brand-600 text-white",
                  d === today && "font-semibold",
                )}
              >
                {Number(d.slice(8, 10))}
                <span className="flex gap-0.5">
                  {free > 0 && <span className={cn("h-1.5 w-1.5 rounded-full", isTarget ? "bg-white" : "bg-brand-300")} title={`свободно: ${free}`} />}
                  {booked > 0 && <span className={cn("h-1.5 w-1.5 rounded-full", isTarget ? "bg-white" : "bg-brand-700")} title={`записей: ${booked}`} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-300" /> есть свободные окна
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-700" /> есть записи
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5">
        <div className="text-lg font-semibold">
          {WEEKDAYS_FULL[(new Date(`${selected}T00:00:00Z`).getUTCDay() + 6) % 7]}, {dayLabel(selected)}
        </div>
        <ul className="mt-4 space-y-2">
          {selectedSlots.length === 0 && <li className="text-sm text-neutral-400">В этот день сессий нет</li>}
          {selectedSlots.map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                isBooked(s) ? "bg-brand-600 text-white" : s.durationMin >= 90 ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-brand-900",
              )}
            >
              <span>
                <b>{s.startsAt.slice(11)}</b>–{minutesToEnd(s)} · {sessionLabel(s.durationMin)}
                {isBooked(s) && ` · ${s.clientName ?? "клиент"}`}
              </span>
              {isFree(s) && (
                <button type="button" disabled={pending} onClick={() => save([], [s.id])} aria-label="Закрыть окно" className="rounded-lg p-1.5 hover:bg-white/60">
                  <IconTrash size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>

        {selected >= today && !copyMode && (
          <div className="mt-5 space-y-3 border-t border-neutral-100 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <TimeSelect value={time} onChange={setTime} />
              <TypePicker value={minutes} onChange={setMinutes} compact />
            </div>
            <Button size="sm" disabled={pending} onClick={add}>
              <IconPlus size={16} /> Добавить сессию
            </Button>
          </div>
        )}

        <div className="mt-5 border-t border-neutral-100 pt-5">
          {!copyMode ? (
            <Button variant="outline" size="sm" disabled={selectedSlots.length === 0} onClick={() => setCopyMode(true)}>
              Скопировать этот день на другие даты
            </Button>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-neutral-600">Отметьте дни в календаре. Скопируем время и тип сессий этого дня.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending || copyTargets.length === 0} onClick={applyCopy}>
                  Скопировать на {copyTargets.length} {copyTargets.length === 1 ? "день" : "дн."}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCopyMode(false);
                    setCopyTargets([]);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function minutesToEnd(s: CabSlot) {
  return timeOf(minutesOfDay(s.startsAt) + s.durationMin);
}
