"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Provider } from "@/lib/payments";
import { startPayment } from "./pay-actions";

// Виджет CloudPayments живёт во внешнем скрипте и появляется в window.cp.
declare global {
  interface Window {
    cp?: {
      CloudPayments: new () => {
        pay: (
          schema: "charge",
          options: Record<string, unknown>,
          handlers: { onSuccess?: () => void; onFail?: (reason: string) => void },
        ) => void;
      };
    };
  }
}

function loadCloudpaymentsWidget(): Promise<void> {
  if (window.cp) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://widget.cloudpayments.ru/bundles/cloudpayments.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Не загрузился виджет оплаты"));
    document.head.appendChild(s);
  });
}

/**
 * Оплата брони. Тестовый контур: показываются оба провайдера, чтобы сравнить
 * флоу и выбрать один. ЮKassa уводит на свою страницу, CloudPayments открывает
 * виджет поверх кабинета; итог в обоих случаях приходит вебхуком.
 */
export function PayButtons({
  slotId,
  priceLabel,
  providers,
}: {
  slotId: number;
  priceLabel: string;
  providers: Provider[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);
  if (providers.length === 0) return null;

  async function pay(provider: Provider) {
    setBusy(provider);
    try {
      const res = await startPayment(slotId, provider);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.kind === "redirect") {
        window.location.href = res.url;
        return;
      }
      await loadCloudpaymentsWidget();
      if (!window.cp) throw new Error("Виджет оплаты недоступен");
      new window.cp.CloudPayments().pay(
        "charge",
        {
          publicId: res.publicId,
          description: res.description,
          amount: res.amount,
          currency: "RUB",
          invoiceId: res.invoiceId,
          accountId: res.email,
          email: res.email,
          skin: "mini",
        },
        {
          onSuccess: () => {
            toast.success("Оплата прошла — статус обновится в течение минуты");
            router.refresh();
          },
          onFail: (reason) => toast.error(`Оплата не прошла: ${reason}`),
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не получилось начать оплату");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {providers.includes("yookassa") && (
        <Button size="sm" disabled={busy !== null} onClick={() => pay("yookassa")}>
          {busy === "yookassa" ? "Открываем…" : `Оплатить ${priceLabel} — ЮKassa`}
        </Button>
      )}
      {providers.includes("cloudpayments") && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => pay("cloudpayments")}
        >
          {busy === "cloudpayments" ? "Открываем…" : `Оплатить ${priceLabel} — CloudPayments`}
        </Button>
      )}
    </div>
  );
}
