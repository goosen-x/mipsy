import "server-only";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { clientRequests, db, matches, psychologists, reviews, slots, topics } from "@/db";
import { canClientChange, formatSlot, isPast } from "@/lib/datetime";
import { currentAccount, isAdmin } from "@/lib/auth";
import { gradePriceLabel, gradeTitle } from "@/lib/grades";
import { catalogUrlFor } from "@/lib/matching";
import { enabledProviders } from "@/lib/payments";
import type { Proposal } from "./proposals-config";

/** Аккаунт и его обращения. Без входа — на /login с возвратом в нужный раздел. */
export async function loadAccount(returnTo = "/me") {
  const account = await currentAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const myRequests = await db
    .select()
    .from(clientRequests)
    .where(eq(clientRequests.accountId, account.id))
    .orderBy(desc(clientRequests.id));
  return { account, myRequests, req: myRequests[0] };
}

/** Переключатель вариантов дизайна: локально и админам; клиентам — вариант по умолчанию. */
export async function canSwitchVariants() {
  return process.env.NODE_ENV === "development" || (await isAdmin());
}

/**
 * Всё, что нужно разделам кабинета по текущему обращению. Разделу без обращения
 * показывать нечего — отправляем на главную кабинета, она объяснит, с чего начать.
 */
export async function loadCabinet(returnTo: string) {
  const { account, myRequests, req } = await loadAccount(returnTo);
  if (!req) redirect("/me");

  const requestIds = myRequests.map((r) => r.id);
  const now = new Date();

  const proposalRows = await db
    .select({ matchId: matches.id, chosen: matches.chosen, note: matches.note, psy: psychologists })
    .from(matches)
    .innerJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(and(eq(matches.clientRequestId, req.id), eq(matches.active, true)));
  const chosen = proposalRows.find((p) => p.chosen);

  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const topicTitle = (slug: string) => topicList.find((t) => t.slug === slug)?.title ?? slug;

  const proposalSlots = proposalRows.length
    ? (
        await db
          .select({ psychologistId: slots.psychologistId, startsAt: slots.startsAt })
          .from(slots)
          .where(
            and(
              inArray(
                slots.psychologistId,
                proposalRows.map((p) => p.psy.id),
              ),
              eq(slots.status, "free"),
            ),
          )
          .orderBy(asc(slots.startsAt))
      ).filter((s) => !isPast(s.startsAt, now))
    : [];

  const mySlots = await db
    .select({
      id: slots.id,
      startsAt: slots.startsAt,
      durationMin: slots.durationMin,
      status: slots.status,
      meetingLink: slots.meetingLink,
      paidAt: slots.paidAt,
      psychologistId: slots.psychologistId,
      clientRequestId: slots.clientRequestId,
      psyName: psychologists.name,
      psyGrade: psychologists.grade,
    })
    .from(slots)
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .where(inArray(slots.clientRequestId, requestIds))
    .orderBy(asc(slots.startsAt));
  const upcoming = mySlots.filter((s) => s.status === "booked" && !isPast(s.startsAt, now));
  // Прошедшее целиком: состоявшиеся, неявки и брони, где специалист ещё не
  // отметил итог, — свежие сверху.
  const past = mySlots
    .filter(
      (s) =>
        s.status === "done" ||
        s.status === "no_show" ||
        (s.status === "booked" && isPast(s.startsAt, now)),
    )
    .reverse();
  const held = past.filter((s) => s.status === "done");

  // Пока по текущему подбору ничего не забронировано, выбор не окончательный:
  // список предложенных остаётся на экране, и можно передумать без переподбора.
  const bookedInThisRequest = mySlots.some(
    (s) => s.clientRequestId === req.id && s.status !== "free",
  );
  const showProposals =
    proposalRows.length > 0 && (!chosen || (!bookedInThisRequest && proposalRows.length > 1));

  const myReviews = held.length
    ? await db
        .select({ slotId: reviews.slotId, rating: reviews.rating, status: reviews.status })
        .from(reviews)
        .where(
          inArray(
            reviews.slotId,
            held.map((s) => s.id),
          ),
        )
    : [];
  const awaitingReview = held.filter((s) => !myReviews.some((r) => r.slotId === s.id));

  // Свободные окна нужны для двух вещей: запись к выбранному специалисту и
  // перенос существующих броней. Бронь могла быть у другого психолога (запись
  // из каталога, прошлый подбор) — перенос предлагает окна именно её специалиста.
  const slotPsyIds = [
    ...new Set([...(chosen ? [chosen.psy.id] : []), ...upcoming.map((s) => s.psychologistId)]),
  ];
  const freeSlots = slotPsyIds.length
    ? (
        await db
          .select()
          .from(slots)
          .where(and(inArray(slots.psychologistId, slotPsyIds), eq(slots.status, "free")))
          .orderBy(asc(slots.startsAt))
      ).filter((s) => !isPast(s.startsAt, now))
    : [];
  const toCalendar = (list: typeof freeSlots) =>
    list.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      isIntroCall: s.isIntroCall,
    }));
  const calendarSlots = chosen
    ? toCalendar(freeSlots.filter((s) => s.psychologistId === chosen.psy.id))
    : [];
  const freeSlotsByPsy = (psyId: number) =>
    toCalendar(freeSlots.filter((s) => s.psychologistId === psyId));

  const proposals = proposalRows.map(
    (p): Proposal => ({
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
        nearestSlot: (() => {
          const slot = proposalSlots.find((s) => s.psychologistId === p.psy.id);
          return slot ? formatSlot(slot.startsAt) : null;
        })(),
        topics: (p.psy.topicSlugs ?? []).map(topicTitle),
      },
    }),
  );

  return {
    account,
    myRequests,
    req,
    now,
    proposals,
    chosen,
    showProposals,
    upcoming,
    past,
    myReviews,
    awaitingReview,
    calendarSlots,
    freeSlotsByPsy,
    canChange: (startsAt: string) => canClientChange(startsAt, now),
    // Кнопки оплаты видны, только когда настроен хотя бы один платёжный провайдер.
    payProviders: enabledProviders(),
    catalogUrl: catalogUrlFor({
      topicSlugs: req.topicSlugs ?? [],
      prefGender: req.prefGender,
      prefAge: req.prefAge,
    }),
  };
}

export type Cabinet = Awaited<ReturnType<typeof loadCabinet>>;
