"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clientRequests, db, psychologists } from "@/db";
import { currentAccountId } from "@/lib/auth";
import { markOutcome, openSlots, psyContact, removePsySlot, setSlotPaid } from "@/lib/booking";
import { messages, notify, subjects } from "@/lib/notify";
import { CONTACTS_ERROR, containsContacts, publicProfileText } from "@/lib/rules";

const NO_SESSION = { ok: false, error: "Войдите в кабинет заново" } as const;

export type ProfileUpdate = {
  meetingUrl: string;
  photoUrl: string;
  approach: string;
  format: string;
  about: string;
  topicSlugs: string[];
  howSessions: string;
  faq: { q: string; a: string }[];

};

export async function updateProfile(
  data: ProfileUpdate,
): Promise<{ ok: boolean; error?: string }> {
  const psy = await me();
  if (!psy) return NO_SESSION;

  // Ту же проверку делает форма, но форма — не защита: экшен можно вызвать напрямую.
  if (containsContacts(publicProfileText(data))) return { ok: false, error: CONTACTS_ERROR };

  await db
    .update(psychologists)
    .set({
      // Одобренный профиль после правок снова показывается оператору на вычитку.
      needsReview: psy.moderationStatus === "approved",
      photoUrl: data.photoUrl?.trim() || null,
      meetingUrl: data.meetingUrl?.trim() || null,
      approach: data.approach?.trim() || null,
      format: data.format || null,
      about: data.about?.trim() || null,
      topicSlugs: data.topicSlugs ?? [],
      howSessions: data.howSessions?.trim() || null,
      faq: (data.faq ?? []).filter((f) => f.q.trim() && f.a.trim()),

    })
    .where(eq(psychologists.id, psy.id));

  revalidatePath("/cab");
  if (psy.slug) revalidatePath(`/p/${psy.slug}`);
  return { ok: true };
}

/** Профиль психолога, который вошёл в кабинет. */
async function me() {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  const [psy] = await db
    .select({
      id: psychologists.id,
      slug: psychologists.slug,
      moderationStatus: psychologists.moderationStatus,
    })
    .from(psychologists)
    .where(eq(psychologists.accountId, accountId));
  return psy ?? null;
}

// Психолог открывает свободные интервалы: одна дата, набор времён,
// опционально повтор на несколько недель вперёд (как у Zigmund).
export async function addSlots(
  data: { date: string; times: string[]; durationMin: number; isIntroCall: boolean; repeatWeeks: number },
): Promise<{ ok: boolean; error?: string; added?: number }> {
  const psy = await me();
  if (!psy) return NO_SESSION;

  const result = await openSlots(db, { psychologistId: psy.id, ...data });
  if (result.ok) revalidatePath("/cab");
  return result;
}

/**
 * Психолог отмечает исход встречи. «Состоялась» открывает клиенту форму отзыва
 * и попадает в аналитику как доведённая сессия.
 */
export async function markSlotOutcome(
  slotId: number,
  outcome: "done" | "no_show",
): Promise<{ ok: boolean; error?: string }> {
  const psy = await me();
  if (!psy) return NO_SESSION;

  const result = await markOutcome(db, { slotId, psychologistId: psy.id, outcome });
  if (!result.ok) return result;
  const slot = result.slot;

  if (outcome === "done" && slot.clientRequestId) {
    const [client] = await db
      .select({
        name: clientRequests.name,
        phone: clientRequests.phone,
        email: clientRequests.email,
      })
      .from(clientRequests)
      .where(eq(clientRequests.id, slot.clientRequestId));
    const [psyFull] = await db
      .select({ name: psychologists.name })
      .from(psychologists)
      .where(eq(psychologists.id, psy.id));
    if (client) {
      await notify({
        kind: "review",
        recipientRole: "client",
        recipientName: client.name,
        recipientPhone: client.phone,
        recipientEmail: client.email,
        subject: subjects.review,
        body: messages.clientReview(psyFull.name),
        clientRequestId: slot.clientRequestId,
        psychologistId: psy.id,
        slotId,
      });
    }
  }

  revalidatePath("/cab");
  revalidatePath("/admin");
  return { ok: true };
}

/** Психолог отмечает, оплатил ли клиент сессию, — клиент видит статус у себя. */
export async function markSlotPaid(
  slotId: number,
  paid: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const psy = await me();
  if (!psy) return NO_SESSION;

  const result = await setSlotPaid(db, { slotId, psychologistId: psy.id, paid });
  if (!result.ok) return result;

  // Клиенту — подтверждение письмом; снятие отметки писем не рождает.
  if (paid && result.slot.clientRequestId) {
    const [client] = await db
      .select({
        name: clientRequests.name,
        phone: clientRequests.phone,
        email: clientRequests.email,
      })
      .from(clientRequests)
      .where(eq(clientRequests.id, result.slot.clientRequestId));
    const psyFull = await psyContact(db, psy.id);
    if (client && psyFull) {
      await notify({
        kind: "paid",
        recipientRole: "client",
        recipientName: client.name,
        recipientPhone: client.phone,
        recipientEmail: client.email,
        subject: subjects.paid,
        body: messages.clientPaid(psyFull.name, result.slot.startsAt),
        clientRequestId: result.slot.clientRequestId,
        psychologistId: psy.id,
        slotId,
      });
    }
  }

  revalidatePath("/cab");
  revalidatePath("/me");
  return { ok: true };
}

/** Перевыпуск ссылки календаря: старый фид перестаёт открываться сразу. */
export async function rotateCalendarToken(): Promise<{ ok: boolean; error?: string }> {
  const psy = await me();
  if (!psy) return NO_SESSION;

  await db
    .update(psychologists)
    .set({ calendarToken: randomBytes(16).toString("hex") })
    .where(eq(psychologists.id, psy.id));
  revalidatePath("/cab");
  return { ok: true };
}

export async function removeSlot(slotId: number): Promise<{ ok: boolean; error?: string }> {
  const psy = await me();
  if (!psy) return NO_SESSION;

  const result = await removePsySlot(db, { slotId, psychologistId: psy.id });
  if (result.ok) revalidatePath("/cab");
  return result;
}
