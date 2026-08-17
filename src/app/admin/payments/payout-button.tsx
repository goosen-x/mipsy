"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPayoutDone } from "./actions";

export function PayoutButton({ psychologistId }: { psychologistId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markPayoutDone(psychologistId);
          if (res.ok) {
            toast.success(`Выплата отмечена: ${res.count} платежей на ${res.amount} ₽`);
          } else {
            toast.error(res.error);
          }
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Отметить выплаченным"}
    </Button>
  );
}
