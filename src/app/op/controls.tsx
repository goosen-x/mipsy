"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQUEST_STATUS_LABELS } from "@/lib/labels";
import {
  assignPsychologist,
  bookSlotForClient,
  dropProposal,
  freeSlot,
  markErrorsSeen,
  markNotificationSent,
  moderatePsychologist,
  moderateReview,
  sendProposals,
  updateRequest,
  updateTicket,
} from "./actions";

export function MarkErrorsSeen() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markErrorsSeen();
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Отметить просмотренными"}
    </Button>
  );
}

export function ReviewModeration({ id }: { id: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const decide = (decision: "published" | "rejected") =>
    startTransition(async () => {
      await moderateReview(id, decision, notes);
      router.refresh();
    });

  return (
    <div>
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Комментарий модерации (необязательно)"
        className="max-w-lg"
      />
      <div className="mt-3 flex gap-3">
        <Button size="sm" disabled={pending} onClick={() => decide("published")}>
          Опубликовать
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => decide("rejected")}>
          Отклонить
        </Button>
      </div>
    </div>
  );
}

export function TicketControls({
  id,
  status,
  notes,
  statusLabels,
}: {
  id: number;
  status: string;
  notes: string;
  statusLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(notes);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={status}
        disabled={pending}
        onValueChange={(v) =>
          startTransition(async () => {
            await updateTicket(id, { status: v });
            router.refresh();
          })
        }
      >
        <SelectTrigger className="w-40 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusLabels).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Что сделали по обращению"
        className="max-w-md bg-white"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateTicket(id, { operatorNotes: value });
            router.refresh();
          })
        }
      >
        Сохранить
      </Button>
    </div>
  );
}

export function SendProposalsButton({ requestId }: { requestId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await sendProposals(requestId);
            if (!res.ok) setError(res.error ?? "Не вышло");
            else {
              setSent(true);
              router.refresh();
            }
          })
        }
      >
        {pending ? "Отправляем…" : "Отправить подборку клиенту"}
      </Button>
      {sent && <span className="text-sm text-brand-700">Отправлено ✓</span>}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

export function DropProposalButton({
  requestId,
  matchId,
}: {
  requestId: number;
  matchId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await dropProposal(requestId, matchId);
          router.refresh();
        })
      }
    >
      убрать
    </Button>
  );
}

export function MarkSentButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationSent(id);
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Отправлено"}
    </Button>
  );
}

export function RequestStatusControl({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(v) =>
        startTransition(async () => {
          await updateRequest(id, { status: v });
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(REQUEST_STATUS_LABELS).map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RequestNotesControl({ id, notes }: { id: number; notes: string }) {
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Textarea
        rows={4}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="Пометки: о чём договорились по телефону, нюансы подбора…"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateRequest(id, { operatorNotes: value });
              setSaved(true);
            })
          }
        >
          {pending ? "Сохраняем…" : "Сохранить пометки"}
        </Button>
        {saved && <span className="text-sm text-brand-700">Сохранено ✓</span>}
      </div>
    </div>
  );
}

/** У старых заявок почты нет — без неё человек не войдёт в кабинет. */
export function RequestEmailControl({ id }: { id: number }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="почта клиента"
        className="max-w-xs"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !value.trim()}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await updateRequest(id, { email: value });
            if (!res.ok) setError(res.error ?? "Не получилось");
            else router.refresh();
          })
        }
      >
        {pending ? "Сохраняем…" : "Открыть доступ"}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

export function AssignControl({
  requestId,
  candidates,
}: {
  requestId: number;
  candidates: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [psyId, setPsyId] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return <p className="text-sm text-neutral-500">Нет одобренных психологов для подбора.</p>;
  }

  return (
    <div className="space-y-3">
      <Select value={psyId} onValueChange={setPsyId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите психолога" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка к подбору (необязательно)"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        disabled={pending || !psyId}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await assignPsychologist(requestId, Number(psyId), note);
            if (!res.ok) setError(res.error ?? "Не получилось");
            else router.refresh();
          })
        }
      >
        {pending ? "Привязываем…" : "Подобрать (заменит текущего)"}
      </Button>
    </div>
  );
}

export function BookSlotControl({
  requestId,
  freeSlots,
}: {
  requestId: number;
  freeSlots: { id: number; label: string }[];
}) {
  const router = useRouter();
  const [slotId, setSlotId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (freeSlots.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        У психолога нет открытых окон — попросите его открыть расписание в кабинете.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={slotId} onValueChange={setSlotId}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Свободное окно" />
        </SelectTrigger>
        <SelectContent>
          {freeSlots.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !slotId}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await bookSlotForClient(requestId, Number(slotId));
            if (!res.ok) setError(res.error ?? "Не вышло");
            else {
              setSlotId("");
              router.refresh();
            }
          })
        }
      >
        {pending ? "…" : "Записать клиента"}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

export function FreeSlotButton({ requestId, slotId }: { requestId: number; slotId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await freeSlot(requestId, slotId);
          router.refresh();
        })
      }
    >
      отменить
    </Button>
  );
}

export function ModerationControl({ psyId, status }: { psyId: number; status: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(decision: "approved" | "rejected") {
    startTransition(async () => {
      await moderatePsychologist(psyId, decision, notes);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Комментарий модерации (виден психологу при отказе)"
      />
      <div className="flex gap-3">
        <Button disabled={pending || status === "approved"} onClick={() => decide("approved")}>
          Одобрить
        </Button>
        <Button
          variant="destructive"
          disabled={pending || status === "rejected"}
          onClick={() => decide("rejected")}
        >
          Отклонить
        </Button>
      </div>
    </div>
  );
}
