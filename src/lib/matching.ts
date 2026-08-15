import { and, eq, gte, inArray } from "drizzle-orm";
import { clientRequests, matches, psychologists, slots } from "../db/schema.ts";
import { releaseSlot, type Db, type PsyContact, type SlotRow } from "./booking.ts";
import { nowMsk } from "./datetime.ts";

/**
 * Автоподбор по анкете: сразу после отправки клиент видит до трёх подходящих
 * специалистов (те же строки matches, что заводит админ, — кабинет и выбор
 * работают без изменений). Пол — жёсткое условие: предлагать мужчину тому,
 * кто просил женщину, хуже, чем не предложить никого. Темы и возраст —
 * мягкие: считаются очками.
 */

export type MatchPrefs = {
  topicSlugs: string[];
  prefGender: string | null; // man | woman | any
  prefAge: string | null; // under40 | over40 | any
};

type Candidate = {
  id: number;
  gender: string | null; // female | male
  birthYear: number | null;
  topicSlugs: string[] | null;
};

/** Пол специалиста, которого просил клиент; null — любой подойдёт. */
export function wantedGender(prefGender: string | null | undefined): "female" | "male" | null {
  if (prefGender === "woman") return "female";
  if (prefGender === "man") return "male";
  return null;
}

function ageBracket(birthYear: number | null, now: Date): "under40" | "over40" | null {
  if (!birthYear) return null;
  return now.getFullYear() - birthYear < 40 ? "under40" : "over40";
}

/**
 * Очки кандидата: совпавшая тема — 2, возраст — 1. Пол не в очках — он
 * отсекает. Неизвестные пол/возраст не мешают: старые заявки без этих полей
 * участвуют в подборе по темам.
 */
export function scoreCandidate(psy: Candidate, prefs: MatchPrefs, now: Date = new Date()): number | null {
  const gender = wantedGender(prefs.prefGender);
  if (gender && psy.gender && psy.gender !== gender) return null;

  let score = 0;
  const topics = new Set(psy.topicSlugs ?? []);
  for (const slug of prefs.topicSlugs ?? []) if (topics.has(slug)) score += 2;

  if (prefs.prefAge && prefs.prefAge !== "any") {
    const bracket = ageBracket(psy.birthYear, now);
    if (bracket === prefs.prefAge) score += 1;
  }
  return score;
}

/** Ссылка «выбрать самому»: каталог с фильтрами из анкеты. */
export function catalogUrlFor(prefs: MatchPrefs): string {
  const usp = new URLSearchParams();
  if (prefs.topicSlugs?.[0]) usp.set("topic", prefs.topicSlugs[0]);
  const gender = wantedGender(prefs.prefGender);
  if (gender) usp.set("gender", gender);
  if (prefs.prefAge && prefs.prefAge !== "any") usp.set("age", prefs.prefAge);
  const s = usp.toString();
  return s ? `/catalog?${s}` : "/catalog";
}

/**
 * Подбирает до limit одобренных специалистов, заводит matches (клиент выбирает
 * сам, chosen не ставим) и переводит заявку в matched. Никто не подошёл —
 * заявка остаётся new, дальше действует админ.
 */
/**
 * Переподбор начинается с чистого листа: все активные предложения заявки
 * гаснут. Без этого старый психолог остаётся «выбранным», занимает лимит
 * из трёх вариантов и продолжает показываться клиенту.
 */
export async function deactivateMatches(db: Db, clientRequestId: number): Promise<void> {
  await db
    .update(matches)
    .set({ active: false, chosen: false })
    .where(and(eq(matches.clientRequestId, clientRequestId), eq(matches.active, true)));
}

export type RetiredClient = {
  requestId: number;
  name: string;
  phone: string | null;
  email: string | null;
  freedSlot: SlotRow | null;
};

/**
 * Снятие психолога с витрины (скрытие или отзыв допуска) не должно бросать
 * его клиентов в подвешенном состоянии: активные предложения гаснут, будущие
 * брони освобождаются, заявки уходят в переподбор. Возвращает, кому писать.
 */
export async function retirePsychologist(
  db: Db,
  psychologistId: number,
  now?: Date,
): Promise<{ psy: PsyContact | null; clients: RetiredClient[] }> {
  const [psy] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      meetingUrl: psychologists.meetingUrl,
    })
    .from(psychologists)
    .where(eq(psychologists.id, psychologistId));

  const activeMatches = await db
    .select({ id: matches.id, clientRequestId: matches.clientRequestId })
    .from(matches)
    .where(and(eq(matches.psychologistId, psychologistId), eq(matches.active, true)));
  const futureBooked = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.psychologistId, psychologistId),
        eq(slots.status, "booked"),
        gte(slots.startsAt, nowMsk(now)),
      ),
    );

  const requestIds = [
    ...new Set([
      ...activeMatches.map((m) => m.clientRequestId),
      ...futureBooked.map((s) => s.clientRequestId).filter((id): id is number => id !== null),
    ]),
  ];
  if (requestIds.length === 0) return { psy: psy ?? null, clients: [] };

  await db
    .update(matches)
    .set({ active: false, chosen: false })
    .where(and(eq(matches.psychologistId, psychologistId), eq(matches.active, true)));
  for (const slot of futureBooked) await releaseSlot(db, slot.id);
  await db
    .update(clientRequests)
    .set({ status: "rematch", rematchReason: "специалист больше не принимает на платформе" })
    .where(inArray(clientRequests.id, requestIds));

  const rows = await db
    .select({
      requestId: clientRequests.id,
      name: clientRequests.name,
      phone: clientRequests.phone,
      email: clientRequests.email,
    })
    .from(clientRequests)
    .where(inArray(clientRequests.id, requestIds));

  return {
    psy: psy ?? null,
    clients: rows.map((r) => ({
      ...r,
      freedSlot: futureBooked.find((s) => s.clientRequestId === r.requestId) ?? null,
    })),
  };
}

export async function autoMatch(
  db: Db,
  params: { clientRequestId: number; prefs: MatchPrefs; limit?: number; now?: Date },
): Promise<number[]> {
  const limit = params.limit ?? 3;
  const candidates = await db
    .select({
      id: psychologists.id,
      gender: psychologists.gender,
      birthYear: psychologists.birthYear,
      topicSlugs: psychologists.topicSlugs,
    })
    .from(psychologists)
    .where(and(eq(psychologists.moderationStatus, "approved"), eq(psychologists.hidden, false)));

  const picked = candidates
    .map((psy) => ({ psy, score: scoreCandidate(psy, params.prefs, params.now) }))
    .filter((c): c is { psy: Candidate & { id: number }; score: number } => c.score !== null)
    // При равных очках вперёд более новые специалисты — им нужнее первые клиенты.
    .sort((a, b) => b.score - a.score || b.psy.id - a.psy.id)
    .slice(0, limit);

  if (picked.length === 0) return [];

  // Идемпотентно: при двойном сабмите анкеты уникальный индекс активной пары
  // «заявка-психолог» не даст задвоить предложения.
  await db
    .insert(matches)
    .values(
      picked.map(({ psy }) => ({
        clientRequestId: params.clientRequestId,
        psychologistId: psy.id,
        note: "автоподбор по анкете",
      })),
    )
    .onConflictDoNothing();
  await db
    .update(clientRequests)
    .set({ status: "matched" })
    .where(eq(clientRequests.id, params.clientRequestId));

  return picked.map(({ psy }) => psy.id);
}
