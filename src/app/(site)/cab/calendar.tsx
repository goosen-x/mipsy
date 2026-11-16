"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rotateCalendarToken } from "./actions";

/** Подписка на брони из внешнего календаря: ссылка фида + перевыпуск. */
export function CalendarFeed({ url }: { url: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 font-mono text-xs text-neutral-600"
        />
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast.success("Ссылка скопирована");
          }}
        >
          Скопировать
        </Button>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-neutral-600">
        <li>
          · <strong>Google Календарь</strong>: Другие календари → «+» → «По URL» → вставьте ссылку.
        </li>
        <li>
          · <strong>Яндекс Календарь</strong>: Новый календарь → «По ссылке» → вставьте ссылку.
        </li>
        <li>
          · <strong>Apple Календарь</strong>: Файл → «Новая подписка на календарь…» → вставьте
          ссылку.
        </li>
      </ul>
      <p className="mt-3 text-xs text-neutral-400">
        Брони, переносы и отмены подтянутся сами при обновлении подписки (Google делает это раз в
        несколько часов). Ссылка секретная — не публикуйте её.{" "}
        <button
          type="button"
          disabled={pending}
          className="underline hover:text-brand-700"
          onClick={() => {
            if (!confirm("Перевыпустить ссылку? Старая перестанет работать, подписку придётся обновить.")) return;
            startTransition(async () => {
              const res = await rotateCalendarToken();
              if (res.ok) toast.success("Ссылка перевыпущена — подпишитесь заново");
              else toast.error(res.error ?? "Не получилось");
            });
          }}
        >
          Перевыпустить, если утекла
        </button>
      </p>
    </div>
  );
}
