// Планировщик напоминаний: живёт внутри процесса Next (запускается из
// instrumentation.ts при старте сервера), проверяет брони каждые 15 минут.
// Отдельного крона на хосте не нужно — контейнер работает постоянно.
import { db } from "@/db";
import { logError } from "./logs";
import { messages, notify, subjects } from "./notify";
import { dueReminders } from "./reminders";

const STEP_MS = 15 * 60 * 1000;

async function tick(): Promise<void> {
  try {
    const due = await dueReminders(db);
    for (const r of due) {
      await notify({
        kind: "reminder",
        recipientRole: "client",
        recipientName: r.clientName,
        recipientPhone: r.clientPhone,
        recipientEmail: r.clientEmail,
        subject: subjects.reminder,
        body: messages.clientReminder(r.psyName, r.startsAt),
        clientRequestId: r.clientRequestId,
        psychologistId: r.psychologistId,
        slotId: r.slotId,
      });
    }
    if (due.length > 0) console.log(`[reminders] поставлено напоминаний: ${due.length}`);
  } catch (e) {
    await logError({ source: "job", message: "планировщик напоминаний упал", detail: e });
  }
}

export function startReminderScheduler(): void {
  // Модуль может импортироваться несколько раз (dev-перезагрузки) — таймер один.
  const g = globalThis as typeof globalThis & { __mipsyReminderTimer?: boolean };
  if (g.__mipsyReminderTimer) return;
  g.__mipsyReminderTimer = true;

  setTimeout(tick, 30_000); // первый проход — после прогрева сервера
  setInterval(tick, STEP_MS);
  console.log("[reminders] планировщик запущен, шаг 15 минут");
}
