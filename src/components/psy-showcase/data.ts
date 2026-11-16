import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, psychologists, slots, topics } from "@/db";
import { formatSlot, isPast } from "@/lib/datetime";
import { gradePriceLabel, gradeTitle } from "@/lib/grades";

/** Всё, что нужно карточке психолога на главной. Сериализуемо — уходит в клиентскую карусель. */
export type ShowcasePsy = {
  id: number;
  href: string;
  name: string;
  photoUrl: string | null;
  approach: string;
  grade: string | null;
  price: string | null;
  experienceYears: number | null;
  about: string | null;
  nearestSlot: string | null;
  topics: string[];
};

export async function loadShowcase(limit = 12): Promise<ShowcasePsy[]> {
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const topicTitle = (slug: string) =>
    topicList.find((t) => t.slug === slug)?.title ?? slug;

  const approved = await db
    .select()
    .from(psychologists)
    .where(
      and(
        eq(psychologists.moderationStatus, "approved"),
        eq(psychologists.hidden, false),
      ),
    )
    .limit(limit);
  if (!approved.length) return [];

  const now = new Date();
  const freeSlots = (
    await db
      .select({
        psychologistId: slots.psychologistId,
        startsAt: slots.startsAt,
      })
      .from(slots)
      .where(
        and(
          inArray(
            slots.psychologistId,
            approved.map((p) => p.id),
          ),
          eq(slots.status, "free"),
        ),
      )
      .orderBy(asc(slots.startsAt))
  ).filter((s) => !isPast(s.startsAt, now));

  return approved.map((p) => {
    const slot = freeSlots.find((s) => s.psychologistId === p.id);
    return {
      id: p.id,
      href: `/psihologi/${p.slug}`,
      name: p.name,
      photoUrl: p.photoUrl,
      approach: p.approach ?? "Психолог",
      grade: gradeTitle(p.grade),
      price: gradePriceLabel(p.grade),
      experienceYears: p.experienceYears,
      about: p.about,
      nearestSlot: slot ? formatSlot(slot.startsAt) : null,
      topics: (p.topicSlugs ?? []).map(topicTitle),
    };
  });
}

/** «9 лет опыта» — с правильным окончанием. */
export function experienceLabel(years: number | null): string | null {
  if (!years) return null;
  const mod10 = years % 10;
  const mod100 = years % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "год"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "года"
        : "лет";
  return `${years} ${word} опыта`;
}
