"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookingCalendar, type CalendarSlot } from "@/components/booking-calendar";
import { bookSlot, cancelBooking, requestRematch } from "./actions";

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

export function CancelBookingButton({ token, slotId }: { token: string; slotId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        variant="outline"
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
      {error && <p className="mt-1 max-w-56 text-xs text-red-600">{error}</p>}
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
