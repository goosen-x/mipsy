"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookingCalendar, type CalendarSlot } from "@/components/booking-calendar";
import { formatSlot } from "@/lib/datetime";
import { bookSlot, cancelBooking, requestRematch, rescheduleSlot } from "./actions";

export function BookingSection({ token, slots }: { token: string; slots: CalendarSlot[] }) {
  const router = useRouter();
  return (
    <BookingCalendar
      slots={slots}
      onBook={async (slotId) => {
        const res = await bookSlot(token, slotId);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}

/** Управление записью: перенос в свободное окно и отмена. */
export function BookingActions({
  token,
  slotId,
  startsAt,
  freeSlots,
  canChange,
}: {
  token: string;
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
        До встречи меньше суток — перенос и отмену согласуйте с оператором по телефону.
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
              const res = await rescheduleSlot(token, slotId, toId);
              if (res.ok) {
                setMode("idle");
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
              const res = await cancelBooking(token, slotId);
              if (!res.ok) setError(res.error ?? "Не получилось");
              else router.refresh();
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

export function RematchControl({ token }: { token: string }) {
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
              await requestRematch(token, reason);
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
