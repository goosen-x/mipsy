"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookingCalendar, type CalendarSlot } from "@/components/booking-calendar";
import { formatSlot } from "@/lib/datetime";
import { bookFirstSession } from "./actions";

export function ProfileBooking({
  slug,
  psyName,
  slots,
  viewer,
}: {
  slug: string;
  psyName: string;
  slots: CalendarSlot[];
  /** Вошедший человек; null — просмотр без сессии, запись предложит войти. */
  viewer: { name: string; email: string } | null;
}) {
  const router = useRouter();
  const [slotId, setSlotId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: viewer?.name ?? "", note: "", pdConsent: true });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = slots.find((s) => s.id === slotId);

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center">
        <p className="text-neutral-600">
          У {psyName} сейчас нет открытых окон. Начните подбор в кабинете — оператор согласует
          время или подберёт похожего специалиста.
        </p>
        <Button asChild className="mt-4 rounded-lg bg-accent-500 hover:bg-accent-600">
          <a href="/login">Начать подбор</a>
        </Button>
      </div>
    );
  }

  if (!chosen) {
    return (
      <div className="rounded-2xl bg-white p-5">
        <BookingCalendar
          slots={slots}
          onBook={async (id) => {
            setSlotId(id);
            return { ok: true };
          }}
        />
      </div>
    );
  }

  if (!viewer) {
    return (
      <div className="rounded-2xl bg-white p-6 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-neutral-500">Вы выбрали</div>
            <div className="text-lg font-semibold">{formatSlot(chosen.startsAt)}</div>
            <div className="text-sm text-brand-700">
              Первая встреча с {psyName} — бесплатно, {chosen.durationMin} минут
            </div>
          </div>
          <Button variant="ghost" onClick={() => setSlotId(null)}>
            Выбрать другое время
          </Button>
        </div>
        <p className="mt-5 text-neutral-600">
          Чтобы записаться, войдите по коду с почты — на неё придут подтверждение и ссылка на
          встречу. Это занимает меньше минуты.
        </p>
        <Button asChild size="lg" className="mt-4 rounded-lg bg-accent-500 px-8 hover:bg-accent-600">
          <a href={`/login?next=${encodeURIComponent(`/p/${slug}`)}`}>Войти и записаться</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-500">Вы выбрали</div>
          <div className="text-lg font-semibold">{formatSlot(chosen.startsAt)}</div>
          <div className="text-sm text-brand-700">
            Первая встреча с {psyName} — бесплатно, {chosen.durationMin} минут
          </div>
        </div>
        <Button variant="ghost" onClick={() => setSlotId(null)}>
          Выбрать другое время
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block">Ваше имя</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Как к вам обращаться"
            />
          </div>
          <div>
            <Label className="mb-1 block">Email</Label>
            <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm">
              <span className="text-neutral-600">Подтверждён: </span>
              <span className="font-medium text-brand-800">{viewer.email}</span>
            </div>
          </div>
        </div>
        <div>
          <Label className="mb-1 block">Коротко о запросе — необязательно</Label>
          <Textarea
            rows={3}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="С чем хотите поработать"
          />
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="pd-direct"
            checked={form.pdConsent}
            onCheckedChange={(c) => setForm({ ...form, pdConsent: c === true })}
          />
          <Label htmlFor="pd-direct" className="text-sm font-normal leading-snug text-neutral-600">
            Соглашаюсь на обработку персональных данных. Ваши контакты видят только оператор и
            выбранный специалист.
          </Label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          size="lg"
          className="rounded-lg bg-accent-500 px-8 hover:bg-accent-600"
          disabled={pending || !form.name.trim() || !form.pdConsent}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await bookFirstSession(slug, chosen.id, form);
              if (!res.ok) setError(res.error);
              else router.push("/me");
            })
          }
        >
          {pending ? "Бронируем…" : "Забронировать бесплатную встречу"}
        </Button>
      </div>
    </div>
  );
}
