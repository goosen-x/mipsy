// Хук Next: выполняется один раз при старте сервера. Здесь живут фоновые
// задачи процесса — сейчас это планировщик напоминаний о встречах.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startReminderScheduler } = await import("./lib/reminder-scheduler");
  startReminderScheduler();
}
