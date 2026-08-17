"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyTicket } from "../actions";

/** Ответ на обращение письмом прямо из карточки. */
export function ReplyForm({ ticketId, email }: { ticketId: number; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ответить письмом
      </Button>
    );
  }

  return (
    <div className="w-full">
      <Textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Ответ уйдёт на ${email}`}
        autoFocus
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={pending || text.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              const res = await replyTicket(ticketId, text);
              if (res.ok) {
                toast.success(`Ответ отправлен на ${email}`);
                setOpen(false);
                setText("");
              } else {
                toast.error(res.error ?? "Не получилось");
              }
              router.refresh();
            })
          }
        >
          {pending ? "Отправляем…" : "Отправить"}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
