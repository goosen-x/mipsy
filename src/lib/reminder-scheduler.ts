// Планировщик напоминаний: живёт внутри процесса Next (запускается из
// instrumentation.ts при старте сервера), проверяет брони каждые 15 минут.
// Отдельного крона на хосте не нужно — контейнер работает постоянно.
import { db } from "@/db";
import { logError } from "./logs";
import { messages, notify, subjects } from "./notify";
import { dueOutcomeSurveys, dueReminders } from "./reminders";

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

    // Опрос после встречи без отмеченного итога: клиенту — «как прошло»,
    // психологу — просьба отметить итог. Оба уведомления в один проход:
    // идемпотентность держится на первом (kind=review на слоте).
    const surveys = await dueOutcomeSurveys(db);
    for (const s of surveys) {
      await notify({
        kind: "review",
        recipientRole: "client",
        recipientName: s.clientName,
        recipientPhone: s.clientPhone,
        recipientEmail: s.clientEmail,
        subject: subjects.review,
        body: messages.clientSurvey(s.psyName, s.startsAt),
        clientRequestId: s.clientRequestId,
        psychologistId: s.psychologistId,
        slotId: s.slotId,
      });
      await notify({
        kind: "outcome",
        recipientRole: "psychologist",
        recipientName: s.psyName,
        recipientPhone: s.psyPhone,
        recipientEmail: s.psyEmail,
        subject: subjects.outcome,
        body: messages.psyOutcomeNudge(s.clientName, s.startsAt),
        clientRequestId: s.clientRequestId,
        psychologistId: s.psychologistId,
        slotId: s.slotId,
      });
    }
    if (surveys.length > 0) console.log(`[reminders] опросов после встречи: ${surveys.length}`);
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
