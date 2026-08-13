"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  clientRequests,
  db,
  matches,
  notifications,
  psychologists,
  reviews,
  slots,
  supportTickets,
} from "@/db";
import { isOperator, OP_COOKIE, opPasswordHash } from "@/lib/op-auth";
import { linkAccount } from "@/lib/auth";
import { isEmail, normalizeEmail } from "@/lib/auth-core";
import { messages, notify, subjects } from "@/lib/notify";
import { logAdmin } from "@/lib/logs";
import { errorLog } from "@/db";

export async function opLogin(password: string): Promise<{ ok: boolean; error?: string }> {
  const hash = opPasswordHash();
  if (!hash) return { ok: false, error: "OPERATOR_PASSWORD не задан на сервере" };
  const { createHash } = await import("node:crypto");
  if (createHash("sha256").update(password).digest("hex") !== hash) {
    return { ok: false, error: "Неверный пароль" };
  }
  const store = await cookies();
  store.set(OP_COOKIE, hash, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
  revalidatePath("/op");
  return { ok: true };
}

export async function opLogout() {
  const store = await cookies();
  store.delete(OP_COOKIE);
  revalidatePath("/op");
}

async function guard() {
  if (!(await isOperator())) throw new Error("Нет доступа");
}

export async function updateRequest(
  id: number,
  data: { status?: string; operatorNotes?: string; email?: string },
): Promise<{ ok: boolean; error?: string }> {
  await guard();

  // Заявкам, заведённым до личных кабинетов, оператор может дописать почту —
  // без неё человек не сможет войти.
  let accountId: number | null = null;
  if (data.email !== undefined && data.email.trim()) {
    const email = normalizeEmail(data.email);
    if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты" };
    const [req] = await db
      .select({ name: clientRequests.name, phone: clientRequests.phone })
      .from(clientRequests)
      .where(eq(clientRequests.id, id));
    if (!req) return { ok: false, error: "Заявка не найдена" };
    accountId = await linkAccount({ email, name: req.name, phone: req.phone });
    if (accountId) {
      await db
        .update(clientRequests)
        .set({ email, accountId })
        .where(eq(clientRequests.id, id));
    }
  }

  // Пустой set() drizzle не примет — обновляем, только если есть что менять.
  if (data.status !== undefined || data.operatorNotes !== undefined) {
    await db
      .update(clientRequests)
      .set({
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.operatorNotes !== undefined ? { operatorNotes: data.operatorNotes } : {}),
      })
      .where(eq(clientRequests.id, id));
  }
  await logAdmin("изменил заявку", {
    type: "request",
    id,
    detail: [
      data.status && `статус → ${data.status}`,
      data.operatorNotes !== undefined && "пометки",
      accountId && "почта для входа",
    ]
      .filter(Boolean)
      .join(", "),
  });
  revalidatePath(`/op/requests/${id}`);
  revalidatePath("/op");
  return { ok: true };
}

/**
 * Подбор: оператор предлагает клиенту 2–3 специалистов, клиент выбирает сам.
 * Повторный вызов добавляет ещё одного к предложенным.
 */
export async function assignPsychologist(
  requestId: number,
  psychologistId: number,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const [psy] = await db
    .select({ id: psychologists.id, status: psychologists.moderationStatus })
    .from(psychologists)
    .where(eq(psychologists.id, psychologistId));
  if (!psy || psy.status !== "approved") return { ok: false, error: "Психолог не одобрен" };

  const current = await db
    .select({ id: matches.id, psychologistId: matches.psychologistId })
    .from(matches)
    .where(and(eq(matches.clientRequestId, requestId), eq(matches.active, true)));
  if (current.some((m) => m.psychologistId === psychologistId)) {
    return { ok: false, error: "Этот специалист уже предложен" };
  }
  if (current.length >= 3) {
    return { ok: false, error: "Больше трёх вариантов клиенту показывать не стоит" };
  }

  await db.insert(matches).values({
    clientRequestId: requestId,
    psychologistId,
    note: note?.trim() || null,
    // Единственный вариант выбираем за клиента, иначе он выбирает сам.
    chosen: current.length === 0,
  });
  await db.update(clientRequests).set({ status: "matched" }).where(eq(clientRequests.id, requestId));

  await logAdmin("предложил психолога", { type: "request", id: requestId, detail: `психолог #${psychologistId}` });
  revalidatePath(`/op/requests/${requestId}`);
  revalidatePath("/op");
  return { ok: true };
}

/** Оператор отправляет клиенту подборку целиком, когда набрал варианты. */
export async function sendProposals(requestId: number): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const [client] = await db
    .select({
      name: clientRequests.name,
      phone: clientRequests.phone,
      email: clientRequests.email,
      accountId: clientRequests.accountId,
    })
    .from(clientRequests)
    .where(eq(clientRequests.id, requestId));
  if (!client) return { ok: false, error: "Заявка не найдена" };
  if (!client.accountId) {
    return { ok: false, error: "У заявки нет почты — впишите адрес, чтобы клиент смог войти" };
  }

  const proposed = await db
    .select({ name: psychologists.name })
    .from(matches)
    .innerJoin(psychologists, eq(matches.psychologistId, psychologists.id))
    .where(and(eq(matches.clientRequestId, requestId), eq(matches.active, true)));
  if (proposed.length === 0) return { ok: false, error: "Сначала подберите специалистов" };

  await notify({
    kind: "matched",
    recipientRole: "client",
    recipientName: client.name,
    recipientPhone: client.phone,
    recipientEmail: client.email,
    subject: subjects.matched,
    body: messages.clientMatched(proposed.map((p) => p.name)),
    clientRequestId: requestId,
  });

  await logAdmin("отправил подборку клиенту", { type: "request", id: requestId });
  revalidatePath(`/op/requests/${requestId}`);
  return { ok: true };
}

export async function dropProposal(
  requestId: number,
  matchId: number,
): Promise<{ ok: boolean }> {
  await guard();
  await db.update(matches).set({ active: false, chosen: false }).where(eq(matches.id, matchId));
  revalidatePath(`/op/requests/${requestId}`);
  return { ok: true };
}

export async function moderateReview(
  id: number,
  decision: "published" | "rejected",
  notes: string,
): Promise<{ ok: boolean }> {
  await guard();
  await db
    .update(reviews)
    .set({ status: decision, moderationNotes: notes?.trim() || null })
    .where(eq(reviews.id, id));
  await logAdmin(decision === "published" ? "опубликовал отзыв" : "отклонил отзыв", {
    type: "review",
    id,
  });
  revalidatePath("/op/reviews");
  revalidatePath("/catalog");
  return { ok: true };
}

export async function updateTicket(
  id: number,
  data: { status?: string; operatorNotes?: string },
): Promise<{ ok: boolean }> {
  await guard();
  await db
    .update(supportTickets)
    .set({
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.operatorNotes !== undefined ? { operatorNotes: data.operatorNotes } : {}),
    })
    .where(eq(supportTickets.id, id));
  await logAdmin("обработал обращение", { type: "ticket", id, detail: data.status ?? "заметка" });
  revalidatePath("/op/support");
  return { ok: true };
}

export async function markErrorsSeen(): Promise<{ ok: boolean }> {
  await guard();
  await db.update(errorLog).set({ seen: true }).where(eq(errorLog.seen, false));
  revalidatePath("/op/errors");
  return { ok: true };
}

/** Отправка уведомления вручную, когда SMS-провайдер не подключён. */
export async function markNotificationSent(id: number): Promise<{ ok: boolean }> {
  await guard();
  await db
    .update(notifications)
    .set({ status: "sent", sentAt: new Date().toISOString().slice(0, 16).replace("T", " ") })
    .where(eq(notifications.id, id));
  revalidatePath("/op/notifications");
  return { ok: true };
}

// Оператор записывает клиента в свободное окно психолога (обычно по телефону).
export async function bookSlotForClient(
  requestId: number,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId));
  if (!slot) return { ok: false, error: "Окно не найдено" };
  if (slot.status !== "free") return { ok: false, error: "Окно уже занято" };

  await db
    .update(slots)
    .set({ status: "booked", clientRequestId: requestId })
    .where(and(eq(slots.id, slotId), eq(slots.status, "free")));

  revalidatePath(`/op/requests/${requestId}`);
  return { ok: true };
}

export async function freeSlot(requestId: number, slotId: number): Promise<{ ok: boolean }> {
  await guard();
  await db
    .update(slots)
    .set({ status: "free", clientRequestId: null })
    .where(eq(slots.id, slotId));
  revalidatePath(`/op/requests/${requestId}`);
  return { ok: true };
}

// Транслит для slug публичной страницы.
function slugify(name: string, id: number): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  const base = name
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "psy"}-${id}`;
}

export async function moderatePsychologist(
  id: number,
  decision: "approved" | "rejected",
  notes: string,
): Promise<{ ok: boolean }> {
  await guard();
  const [psy] = await db
    .select({ id: psychologists.id, name: psychologists.name, slug: psychologists.slug })
    .from(psychologists)
    .where(eq(psychologists.id, id));
  if (!psy) return { ok: false };

  await db
    .update(psychologists)
    .set({
      moderationStatus: decision,
      moderationNotes: notes?.trim() || null,
      slug: decision === "approved" ? (psy.slug ?? slugify(psy.name, psy.id)) : psy.slug,
      needsReview: false,
    })
    .where(eq(psychologists.id, id));

  const [full] = await db
    .select({
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
    })
    .from(psychologists)
    .where(eq(psychologists.id, id));
  await notify({
    kind: "moderation",
    recipientRole: "psychologist",
    recipientName: full.name,
    recipientPhone: full.phone,
    recipientEmail: full.email,
    subject: subjects.moderation,
    body: messages.psyModerated(decision === "approved"),
    psychologistId: id,
  });
  await logAdmin(decision === "approved" ? "одобрил психолога" : "отклонил психолога", {
    type: "psychologist",
    id,
    detail: notes?.trim() || undefined,
  });
  revalidatePath(`/op/psy/${id}`);
  revalidatePath("/op/psy");
  revalidatePath("/");
  return { ok: true };
}
