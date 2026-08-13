"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookingCalendar, type CalendarSlot } from "@/components/booking-calendar";
import { formatSlot } from "@/lib/datetime";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  bookSlot,
  cancelBooking,
  choosePsychologist,
  createTicket,
  leaveReview,
  requestRematch,
  rescheduleSlot,
} from "./actions";

export function ChoosePsychologist({ psychologistId }: { psychologistId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        className="rounded-lg bg-accent-500 hover:bg-accent-600"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await choosePsychologist(psychologistId);
            if (!res.ok) setError(res.error ?? "Не получилось");
            else {
              toast.success("Специалист выбран — осталось выбрать время");
              router.refresh();
            }
          })
        }
      >
        {pending ? "Выбираем…" : "Выбрать этого психолога"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ReviewForm({ slotId }: { slotId: number }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} из 5`}
            className={cn(
              "text-2xl transition-colors",
              n <= rating ? "text-accent-500" : "text-neutral-300 hover:text-accent-400",
            )}
          >
            ★
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        className="mt-3"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Что было полезно? Что стоит знать другим? (необязательно)"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <Button
        className="mt-3"
        disabled={pending || rating === 0}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await leaveReview(slotId, rating, body);
            if (!res.ok) setError(res.error ?? "Не получилось");
            else {
              toast.success("Спасибо! Отзыв уйдёт в профиль после проверки");
              router.refresh();
            }
          })
        }
      >
        {pending ? "Отправляем…" : "Оставить отзыв"}
      </Button>
      <p className="mt-2 text-xs text-neutral-400">
        Отзыв публикуется после проверки оператором, с вашим именем без фамилии.
      </p>
    </div>
  );
}

export function SupportForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"question" | "complaint">("question");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
        Обращение принято. Оператор свяжется с вами в течение рабочего дня.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        {(
          [
            ["question", "Вопрос"],
            ["complaint", "Жалоба"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setKind(v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              kind === v
                ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                : "border-neutral-200 hover:border-brand-400",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Label className="mt-3 block text-sm font-normal text-neutral-500">
        {kind === "complaint"
          ? "Расскажите, что произошло. Мы разберёмся и ответим."
          : "О чём вопрос?"}
      </Label>
      <Textarea rows={3} className="mt-1" value={body} onChange={(e) => setBody(e.target.value)} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <Button
        variant="outline"
        className="mt-3"
        disabled={pending || body.trim().length < 5}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createTicket(kind, body);
            if (!res.ok) setError(res.error ?? "Не получилось");
            else {
              setSent(true);
              toast.success("Обращение принято — оператор ответит в течение рабочего дня");
              router.refresh();
            }
          })
        }
      >
        {pending ? "Отправляем…" : "Отправить"}
      </Button>
    </div>
  );
}

export function BookingSection({ slots }: { slots: CalendarSlot[] }) {
  const router = useRouter();
  return (
    <BookingCalendar
      slots={slots}
      onBook={async (slotId) => {
        const res = await bookSlot(slotId);
        if (res.ok) {
          toast.success("Вы записаны. Подтверждение и приглашение в календарь ушли на почту");
          router.refresh();
        }
        return res;
      }}
    />
  );
}

/** Управление записью: перенос в свободное окно и отмена. */
export function BookingActions({
  slotId,
  startsAt,
  freeSlots,
  canChange,
}: {
  slotId: number;
  startsAt: string;
  freeSlots: CalendarSlot[];
  canChange: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "move">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canChange) {
    return (
      <p className="max-w-64 text-xs text-neutral-500">
        До встречи меньше суток — перенос и отмену согласуйте с оператором: напишите в поддержку
        ниже.
      </p>
    );
  }

  if (mode === "move") {
    return (
      <div className="w-full">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-neutral-500">
            Перенести встречу {formatSlot(startsAt)} на:
          </span>
          <Button variant="ghost" size="sm" onClick={() => setMode("idle")}>
            Отмена
          </Button>
        </div>
        {freeSlots.length === 0 ? (
          <p className="text-sm text-neutral-500">
            У специалиста нет других свободных окон — напишите оператору.
          </p>
        ) : (
          <BookingCalendar
            slots={freeSlots}
            submitLabel="Перенести встречу"
            onBook={async (toId) => {
              const res = await rescheduleSlot(slotId, toId);
              if (res.ok) {
                setMode("idle");
                toast.success("Встреча перенесена — психолог уже знает");
                router.refresh();
              }
              return res;
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setMode("move")}>
          Перенести
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await cancelBooking(slotId);
              if (!res.ok) setError(res.error ?? "Не получилось");
              else {
                toast.success("Встреча отменена");
                router.refresh();
              }
            })
          }
        >
          {pending ? "Отменяем…" : "Отменить"}
        </Button>
      </div>
      {error && <p className="max-w-64 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RematchControl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Попросить другого психолога
      </Button>
    );
  }

  return (
    <div>
      <Textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Что не подошло? Это поможет подобрать точнее (необязательно)"
      />
      <div className="mt-3 flex gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await requestRematch(reason);
              toast.success("Запрос принят — оператор подберёт другого специалиста");
              router.refresh();
            })
          }
        >
          {pending ? "Отправляем…" : "Отправить запрос"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
