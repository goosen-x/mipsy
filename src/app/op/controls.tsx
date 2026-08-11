"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQUEST_STATUS_LABELS } from "@/lib/labels";
import { addSession, assignPsychologist, moderatePsychologist, updateRequest } from "./actions";

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

export function AddSessionControl({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [when, setWhen] = useState("");
  const [intro, setIntro] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        placeholder="Когда: напр. 15.08 в 18:00"
        className="w-56"
      />
      <div className="flex items-center gap-2">
        <Checkbox id={`intro-${matchId}`} checked={intro} onCheckedChange={(c) => setIntro(c === true)} />
        <Label htmlFor={`intro-${matchId}`} className="text-sm font-normal">
          знакомство 20 мин
        </Label>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !when.trim()}
        onClick={() =>
          startTransition(async () => {
            await addSession(matchId, when, intro);
            setWhen("");
            setIntro(false);
            router.refresh();
          })
        }
      >
        {pending ? "…" : "Добавить встречу"}
      </Button>
    </div>
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
