"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, psychologists, slots } from "@/db";

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
    .select({
      id: psychologists.id,
      slug: psychologists.slug,
      moderationStatus: psychologists.moderationStatus,
    })
    .from(psychologists)
    .where(eq(psychologists.cabinetToken, token));
  if (!psy) return { ok: false, error: "Кабинет не найден" };

  await db
    .update(psychologists)
    .set({
      // Одобренный профиль после правок снова показывается оператору на вычитку.
      needsReview: psy.moderationStatus === "approved",
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

async function psyByToken(token: string) {
  const [psy] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.cabinetToken, token));
  return psy ?? null;
}

// Психолог открывает свободные интервалы: одна дата, набор времён,
// опционально повтор на несколько недель вперёд (как у Zigmund).
export async function addSlots(
  token: string,
  data: { date: string; times: string[]; durationMin: number; isIntroCall: boolean; repeatWeeks: number },
): Promise<{ ok: boolean; error?: string; added?: number }> {
  const psy = await psyByToken(token);
  if (!psy) return { ok: false, error: "Кабинет не найден" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false, error: "Проверьте дату" };
  const times = (data.times ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t));
  if (times.length === 0) return { ok: false, error: "Добавьте хотя бы одно время" };

  const weeks = Math.min(Math.max(data.repeatWeeks || 1, 1), 8);
  const base = new Date(`${data.date}T00:00:00Z`);
  const rows: { psychologistId: number; startsAt: string; durationMin: number; isIntroCall: boolean }[] = [];

  for (let w = 0; w < weeks; w++) {
    const day = new Date(base.getTime() + w * 7 * 86400000).toISOString().slice(0, 10);
    for (const time of times) {
      rows.push({
        psychologistId: psy.id,
        startsAt: `${day}T${time}`,
        durationMin: data.durationMin || 50,
        isIntroCall: data.isIntroCall,
      });
    }
  }

  const existing = await db
    .select({ startsAt: slots.startsAt })
    .from(slots)
    .where(eq(slots.psychologistId, psy.id));
  const taken = new Set(existing.map((s) => s.startsAt));
  const fresh = rows.filter((r) => !taken.has(r.startsAt));
  if (fresh.length > 0) await db.insert(slots).values(fresh);

  revalidatePath(`/cab/${token}`);
  return { ok: true, added: fresh.length };
}

export async function removeSlot(token: string, slotId: number): Promise<{ ok: boolean; error?: string }> {
  const psy = await psyByToken(token);
  if (!psy) return { ok: false, error: "Кабинет не найден" };

  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot || slot.psychologistId !== psy.id) return { ok: false, error: "Слот не найден" };
  if (slot.status === "booked") {
    return { ok: false, error: "На это время записан клиент — отмену согласуйте с оператором" };
  }

  await db.delete(slots).where(and(eq(slots.id, slotId), eq(slots.psychologistId, psy.id)));
  revalidatePath(`/cab/${token}`);
  return { ok: true };
}
