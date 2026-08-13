"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatDay, groupByDate } from "@/lib/datetime";
import { toast } from "sonner";
import { addSlots, markSlotOutcome, removeSlot } from "./actions";

/** Отметка исхода прошедшей встречи. */
export function OutcomeControl({ slotId }: { slotId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mark = (outcome: "done" | "no_show") =>
    startTransition(async () => {
      const res = await markSlotOutcome(slotId, outcome);
      if (!res.ok) setError(res.error ?? "Не вышло");
      else {
        toast.success(
          outcome === "done"
            ? "Встреча отмечена — клиент получит просьбу оценить её"
            : "Отмечено: клиент не пришёл",
        );
        router.refresh();
      }
    });

  return (
    <span className="flex items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => mark("done")}>
        Встреча состоялась
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark("no_show")}>
        не пришёл
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

type Slot = {
  id: number;
  startsAt: string;
  durationMin: number;
  status: string;
  isIntroCall: boolean;
  clientName: string | null;
};

const TIME_OPTIONS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00",
];

export function Schedule({ slots }: { slots: Slot[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [duration, setDuration] = useState("50");
  const [repeat, setRepeat] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const days = groupByDate(slots);

  function submit() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await addSlots({
        date,
        times,
        durationMin: Number(duration) || 50,
        isIntroCall: false,
        repeatWeeks: Number(repeat) || 1,
      });
      if (!res.ok) setError(res.error ?? "Не получилось");
      else {
        const message =
          res.added === 0 ? "Такое время уже открыто" : `Добавлено окон: ${res.added}`;
        setInfo(message);
        if (res.added === 0) toast.info(message);
        else toast.success(message);
        setTimes([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Добавление */}
      <div className="rounded-2xl border p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block">Дата</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Длительность, минут</Label>
            <Input
              type="number"
              min={20}
              max={120}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        <Label className="mt-4 mb-2 block">Время (можно несколько)</Label>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => {
            const active = times.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTimes(active ? times.filter((x) => x !== t) : [...times, t])}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-neutral-200 hover:border-brand-400",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="repeat" className="text-sm font-normal">
              Повторять недель
            </Label>
            <Input
              id="repeat"
              type="number"
              min={1}
              max={8}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="w-20"
            />
          </div>
          <span className="text-sm text-neutral-500">
            Первая встреча каждого нового клиента бесплатная — отмечать это не нужно.
          </span>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {info && <p className="mt-3 text-sm text-brand-700">{info}</p>}
        <Button className="mt-4" disabled={pending || !date || times.length === 0} onClick={submit}>
          {pending ? "Добавляем…" : "Открыть это время"}
        </Button>
      </div>

      {/* Список окон */}
      {days.length === 0 ? (
        <p className="text-neutral-500">
          Открытых окон пока нет. Клиенты смогут записаться только в то время, которое вы откроете.
        </p>
      ) : (
        <div className="space-y-4">
          {days.map(([day, daySlots]) => (
            <div key={day}>
              <div className="text-sm font-medium text-neutral-500">{formatDay(day)}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <SlotChip key={s.id} slot={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotChip({ slot }: { slot: Slot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const booked = slot.status === "booked";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
        booked ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-200",
      )}
      title={error ?? undefined}
    >
      {slot.startsAt.split("T")[1]}
      {slot.isIntroCall && <span className="text-xs text-neutral-500">знакомство</span>}
      {booked ? (
        <span className="text-xs font-medium">записан {slot.clientName ?? "клиент"}</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await removeSlot(slot.id);
              if (!res.ok) setError(res.error ?? "Не вышло");
              else {
                toast.success("Окно убрано");
                router.refresh();
              }
            })
          }
          className="text-neutral-400 hover:text-red-600"
          aria-label="Убрать окно"
        >
          ✕
        </button>
      )}
    </span>
  );
}
