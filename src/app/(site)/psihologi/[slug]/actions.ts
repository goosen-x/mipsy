"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateClientCabinet } from "@/lib/revalidate-cabinet";
import { clientRequests, db, matches, psychologists } from "@/db";
import { claimRole, currentAccount, linkAccount } from "@/lib/auth";
import { takeSlot } from "@/lib/booking";
import { meetingInvite, messages, notify, psyMeetingInvite, subjects } from "@/lib/notify";

export type DirectBooking = {
  name: string;
  note: string;
  pdConsent: boolean;
  marketingConsent: boolean;
};

/**
 * Запись напрямую из профиля/каталога: клиент сам выбрал специалиста и время.
 * Доступна после входа — почта подтверждена, бронь не попадёт в чужой кабинет.
 */
export async function bookFirstSession(
  slug: string,
  slotId: number,
  data: DirectBooking,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Войдите на сайт, чтобы записаться" };

  const name = data.name?.trim();
  const email = account.email;
  if (!name) return { ok: false, error: "Укажите имя" };
  if (!data.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  // Одна почта — один кабинет: специалист не записывается к коллеге со своего
  // рабочего адреса, иначе на аккаунте снова окажутся обе роли.
  const conflict = await claimRole(account.id, "client");
  if (conflict) return { ok: false, error: conflict };

  // Имя аккаунта могло быть заглушкой из адреса почты — бронь его уточняет.
  await linkAccount({ email, name });

  const [psy] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
      meetingUrl: psychologists.meetingUrl,
    })
    .from(psychologists)
    .where(
      and(
        eq(psychologists.slug, slug),
        eq(psychologists.moderationStatus, "approved"),
        eq(psychologists.hidden, false),
      ),
    );
  if (!psy) return { ok: false, error: "Специалист не найден" };

  // Психолог из подборки клиента: запись идёт в то же обращение, а не в новое.
  // Иначе подборка уезжала в «Прошлые обращения», а заявка висела у оператора.
  const [lastRequest] = await db
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(eq(clientRequests.accountId, account.id))
    .orderBy(desc(clientRequests.id))
    .limit(1);
  const [proposal] = lastRequest
    ? await db
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.clientRequestId, lastRequest.id),
            eq(matches.psychologistId, psy.id),
            eq(matches.active, true),
          ),
        )
    : [];

  let requestId: number;
  if (proposal) {
    requestId = lastRequest.id;
  } else {
    const [created] = await db
      .insert(clientRequests)
      .values({
        forWhom: "self",
        accountId: account.id,
        name,
        email,
        // Телефон известен из аккаунта (если человек оставлял его в анкете) —
        // иначе уведомления по этой заявке навсегда остались бы без SMS-канала.
        phone: account.phone,
        story: data.note?.trim().slice(0, 4000) || null,
        pdConsent: true,
        marketingConsent: data.marketingConsent,
        status: "matched",
        clientToken: randomUUID(),
      })
      .returning({ id: clientRequests.id });
    requestId = created.id;
  }

  const booked = await takeSlot(db, {
    slotId,
    psychologist: psy,
    clientRequestId: requestId,
  });
  if (!booked.ok) {
    if (!proposal) await db.delete(clientRequests).where(eq(clientRequests.id, requestId));
    return booked;
  }
  const slot = booked.slot;

  if (proposal) {
    // Записался — значит выбрал: в кабинете он сразу «ваш психолог».
    await db
      .update(matches)
      .set({ chosen: false })
      .where(and(eq(matches.clientRequestId, requestId), eq(matches.active, true)));
    await db.update(matches).set({ chosen: true }).where(eq(matches.id, proposal.id));
  } else {
    await db.insert(matches).values({
      clientRequestId: requestId,
      psychologistId: psy.id,
      note: "выбрал сам в каталоге",
      // Клиент выбрал специалиста сам — в кабинете он сразу «ваш психолог»,
      // без повторного шага выбора.
      chosen: true,
    });
  }

  await notify({
    kind: "booked",
    recipientRole: "client",
    recipientName: name,
    recipientEmail: email,
    subject: subjects.booked,
    body: messages.clientBooked(psy.name, slot.startsAt, psy.meetingUrl),
    attachments: [
      meetingInvite({
        slotId,
        clientRequestId: requestId,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        psyName: psy.name,
        meetingLink: psy.meetingUrl,
      }),
    ],
    clientRequestId: requestId,
    psychologistId: psy.id,
    slotId,
  });
  await notify({
    kind: "booked",
    recipientRole: "psychologist",
    recipientName: psy.name,
    recipientPhone: psy.phone,
    recipientEmail: psy.email,
    subject: subjects.booked,
    body: messages.psyBooked(name, slot.startsAt),
    attachments: [
      psyMeetingInvite({
        slotId,
        clientRequestId: requestId,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        clientName: name,
        meetingLink: psy.meetingUrl,
      }),
    ],
    clientRequestId: requestId,
    psychologistId: psy.id,
    slotId,
  });

  revalidatePath(`/psihologi/${slug}`);
  revalidateClientCabinet();
  revalidatePath("/admin");
  return { ok: true };
}
