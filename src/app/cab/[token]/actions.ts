"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, psychologists } from "@/db";

export type ProfileUpdate = {
  photoUrl: string;
  approach: string;
  format: string;
  price: string;
  about: string;
  topicSlugs: string[];
  howSessions: string;
  faq: { q: string; a: string }[];
  introCallEnabled: boolean;
};

export async function updateProfile(
  token: string,
  data: ProfileUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const [psy] = await db
    .select({ id: psychologists.id, slug: psychologists.slug })
    .from(psychologists)
    .where(eq(psychologists.cabinetToken, token));
  if (!psy) return { ok: false, error: "Кабинет не найден" };

  await db
    .update(psychologists)
    .set({
      photoUrl: data.photoUrl?.trim() || null,
      approach: data.approach?.trim() || null,
      format: data.format || null,
      price: data.price?.trim() || null,
      about: data.about?.trim() || null,
      topicSlugs: data.topicSlugs ?? [],
      howSessions: data.howSessions?.trim() || null,
      faq: (data.faq ?? []).filter((f) => f.q.trim() && f.a.trim()),
      introCallEnabled: data.introCallEnabled,
    })
    .where(eq(psychologists.id, psy.id));

  revalidatePath(`/cab/${token}`);
  if (psy.slug) revalidatePath(`/p/${psy.slug}`);
  return { ok: true };
}
