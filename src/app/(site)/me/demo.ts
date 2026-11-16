import "server-only";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { clientRequests, db, psychologists, topics } from "@/db";
import type { Account } from "@/lib/auth";
import { canClientChange, formatSlot, mskPlusHours } from "@/lib/datetime";
import { gradePriceLabel, gradeTitle } from "@/lib/grades";
import { catalogUrlFor } from "@/lib/matching";
import { enabledProviders } from "@/lib/payments";
import type { Cabinet } from "./data";
import type { Proposal } from "./proposals-config";

/**
 * Демо кабинета клиента — чтобы показать варианты интерфейса по ссылке, без
 * входа и без чужих аккаунтов. Ссылка /demo?state=…&layout=…&v=… ставит куку
 * DEMO_COOKIE, и /me рисуется на выдуманных данных.
 *
 * Клиент, заявка и встречи выдуманы; психологи — настоящие одобренные из базы
 * (их данные и так публичны в каталоге). У всех выдуманных записей
 * отрицательные id: любое действие из демо сервер отклонит, в базу ничего
 * не попадёт.
 */
export const DEMO_COOKIE = "me_demo";

export const DEMO_STATES = [
  { key: "new", label: "Только вошёл" },
  { key: "waiting", label: "Анкета у оператора" },
  { key: "proposals", label: "Пришла подборка" },
  { key: "chosen", label: "Психолог выбран" },
  { key: "booked", label: "Встреча назначена" },
  { key: "after", label: "После встречи" },
] as const;

export type DemoState = (typeof DEMO_STATES)[number]["key"];

export function isDemoState(value: string | undefined | null): value is DemoState {
  return DEMO_STATES.some((s) => s.key === value);
}

/** Ответ любого действия клиента в демо: ничего не сохраняем. */
export const DEMO_BLOCKED = { ok: false, error: "Это демо: действия здесь не сохраняются" } as const;

export async function readDemoState(): Promise<DemoState | null> {
  const value = (await cookies()).get(DEMO_COOKIE)?.value;
  return isDemoState(value) ? value : null;
}

export const DEMO_ACCOUNT: Account = {
  id: -1,
  email: "anna@example.com",
  name: "Анна",
  phone: null,
  isAdmin: false,
  role: "client",
};

type RequestRow = typeof clientRequests.$inferSelect;

export function demoRequest(state: DemoState): RequestRow | undefined {
  if (state === "new") return undefined;
  return {
    id: -1,
    createdAt: mskPlusHours(-72).replace("T", " "),
    accountId: -1,
    forWhom: "self",
    gender: "female",
    age: 29,
    therapyExperience: "none",
    mainProblem: "Тревога и сон",
    topicSlugs: ["anxiety", "sleep"],
    topicOther: null,
    freqDown: null,
    freqSleep: null,
    freqSelfHarm: null,
    lifeImpact: null,
    prefGender: "any",
    prefAge: "any",
    preferredTime: ["evening"],
    story: null,
    name: "Анна",
    phone: null,
    email: DEMO_ACCOUNT.email,
    pdConsent: true,
    marketingConsent: false,
    crisisFlag: false,
    status: state === "waiting" ? "new" : "matched",
    operatorNotes: null,
    clientToken: null,
  } as RequestRow;
}

/** Ровно час: «через N дней в HH:00» по Москве. */
function at(daysFromNow: number, hour: number): string {
  return `${mskPlusHours(daysFromNow * 24).slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}

export async function buildDemoCabinet(state: DemoState): Promise<Cabinet> {
  const req = demoRequest(state)!;
  const now = new Date();

  const psys = await db
    .select()
    .from(psychologists)
    .where(eq(psychologists.moderationStatus, "approved"))
    .orderBy(asc(psychologists.id))
    .limit(3);
  const topicList = await db.select().from(topics);
  const topicTitle = (slug: string) => topicList.find((t) => t.slug === slug)?.title ?? slug;

  const withProposals = state !== "waiting";
  const chosenIndex = state === "proposals" || state === "waiting" ? -1 : 0;

  const rows = withProposals
    ? psys.map((psy, i) => ({ matchId: -(i + 1), chosen: i === chosenIndex, note: null, psy }))
    : [];
  const chosen = rows.find((r) => r.chosen);

  const proposals = rows.map(
    (p, i): Proposal => ({
      matchId: p.matchId,
      chosen: p.chosen,
      note: p.note,
      psy: {
        id: p.psy.id,
        slug: p.psy.slug,
        name: p.psy.name,
        photoUrl: p.psy.photoUrl,
        approach: p.psy.approach,
        experienceYears: p.psy.experienceYears,
        about: p.psy.about,
        gradeTitle: gradeTitle(p.psy.grade),
        price: gradePriceLabel(p.psy.grade),
        nearestSlot: formatSlot(at(i + 1, 11 + i * 2)),
        topics: (p.psy.topicSlugs ?? []).map(topicTitle),
      },
    }),
  );

  type SlotRow = Cabinet["upcoming"][number];
  const slot = (id: number, startsAt: string, extra: Partial<SlotRow> = {}): SlotRow => ({
    id,
    startsAt,
    durationMin: 50,
    status: "booked",
    meetingLink: null,
    paidAt: null,
    psychologistId: chosen?.psy.id ?? 0,
    clientRequestId: req.id,
    psyName: chosen?.psy.name ?? "",
    psyGrade: chosen?.psy.grade ?? null,
    ...extra,
  });

  const upcoming: SlotRow[] =
    state === "booked"
      ? [slot(-11, at(2, 19))]
      : state === "after"
        ? [slot(-12, at(5, 19), { paidAt: mskPlusHours(-1), meetingLink: "https://telemost.yandex.ru/" })]
        : [];
  const past: SlotRow[] = state === "after" ? [slot(-13, at(-2, 19), { status: "done", paidAt: mskPlusHours(-60) })] : [];

  const free =
    state === "chosen"
      ? [1, 1, 2, 3, 3, 4].map((d, i) => ({
          id: -(100 + i),
          startsAt: at(d, i % 2 ? 19 : 11),
          durationMin: 50,
          isIntroCall: false,
        }))
      : [];

  return {
    account: DEMO_ACCOUNT,
    myRequests: [req],
    req,
    now,
    proposals,
    chosen,
    // Как в настоящем кабинете: пока не записался — подборка остаётся на экране.
    showProposals: rows.length > 0 && (!chosen || (upcoming.length === 0 && past.length === 0)),
    upcoming,
    past,
    myReviews: [],
    awaitingReview: past.filter((s) => s.status === "done"),
    calendarSlots: free,
    freeSlotsByPsy: () => free,
    canChange: (startsAt: string) => canClientChange(startsAt, now),
    payProviders: enabledProviders(),
    catalogUrl: catalogUrlFor({ topicSlugs: req.topicSlugs ?? [], prefGender: req.prefGender, prefAge: req.prefAge }),
  };
}
