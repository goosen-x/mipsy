"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  accounts,
  clientRequests,
  db,
  matches,
  notifications,
  psychologists,
  reviews,
  supportTickets,
} from "@/db";
import { currentAccountId, isAdmin, linkAccount } from "@/lib/auth";
import { bookSlotForRequest, releaseSlot } from "@/lib/booking";
import { isEmail, normalizeEmail } from "@/lib/auth-core";
import { gradeTitle, isGrade } from "@/lib/grades";
import { messages, notify, subjects } from "@/lib/notify";
import { logAdmin } from "@/lib/logs";
import { errorLog } from "@/db";

async function guard() {
  if (!(await isAdmin())) throw new Error("Нет доступа");
}

/**
 * Роль выдаётся аккаунту, который уже существует: человек сначала входит по
 * коду с почты, потом его делают админом. Так роль не появится у адреса,
 * которым никто не владеет.
 */
export async function grantAdmin(rawEmail: string): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты" };

  const [account] = await db
    .select({ id: accounts.id, isAdmin: accounts.isAdmin })
    .from(accounts)
    .where(eq(accounts.email, email));
  if (!account) {
    return {
      ok: false,
      error: "Аккаунта с этой почтой нет. Пусть человек сначала войдёт на сайт по коду — /login",
    };
  }
  if (account.isAdmin) return { ok: false, error: "Этот аккаунт уже админ" };

  await db.update(accounts).set({ isAdmin: true }).where(eq(accounts.id, account.id));
  await logAdmin("выдал права админа", { type: "account", id: account.id, detail: email });
  revalidatePath("/admin/team");
  return { ok: true };
}

/**
 * Скрыть/показать психолога: скрытый пропадает из каталога и автоподбора,
 * его страница отдаёт 404. Существующие брони не трогаются.
 */
export async function setPsychologistHidden(
  id: number,
  hidden: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  await db.update(psychologists).set({ hidden }).where(eq(psychologists.id, id));
  await logAdmin(hidden ? "скрыл психолога" : "показал психолога", { type: "psychologist", id });
  revalidatePath(`/admin/psy/${id}`);
  revalidatePath("/admin/psy");
  revalidatePath("/catalog");
  return { ok: true };
}

/** Скрыть/показать аккаунт: скрытый не может войти, сессии перестают работать. */
export async function setAccountHidden(
  accountId: number,
  hidden: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  if (hidden && (await currentAccountId()) === accountId) {
    return { ok: false, error: "Себя скрыть нельзя" };
  }

  await db.update(accounts).set({ hidden }).where(eq(accounts.id, accountId));
  await logAdmin(hidden ? "скрыл аккаунт" : "показал аккаунт", { type: "account", id: accountId });
  revalidatePath("/admin");
  return { ok: true };
}

export async function revokeAdmin(accountId: number): Promise<{ ok: boolean; error?: string }> {
  await guard();
  if ((await currentAccountId()) === accountId) {
    return { ok: false, error: "Себя разжаловать нельзя — попросите другого админа" };
  }

  await db.update(accounts).set({ isAdmin: false }).where(eq(accounts.id, accountId));
  await logAdmin("снял права админа", { type: "account", id: accountId });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function updateRequest(
  id: number,
  data: { status?: string; operatorNotes?: string; email?: string },
): Promise<{ ok: boolean; error?: string }> {
  await guard();

  // Заявкам, заведённым до личных кабинетов, админ может дописать почту —
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
    const linked = await linkAccount({ email, name: req.name, phone: req.phone });
    accountId = linked?.id ?? null;
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
  revalidatePath(`/admin/requests/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Подбор: админ предлагает клиенту 2–3 специалистов, клиент выбирает сам.
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
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Админ отправляет клиенту подборку целиком, когда набрал варианты. */
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
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true };
}

export async function dropProposal(
  requestId: number,
  matchId: number,
): Promise<{ ok: boolean }> {
  await guard();
  await db.update(matches).set({ active: false, chosen: false }).where(eq(matches.id, matchId));
  revalidatePath(`/admin/requests/${requestId}`);
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
  revalidatePath("/admin/reviews");
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
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function markErrorsSeen(): Promise<{ ok: boolean }> {
  await guard();
  await db.update(errorLog).set({ seen: true }).where(eq(errorLog.seen, false));
  revalidatePath("/admin/errors");
  return { ok: true };
}

/** Отправка уведомления вручную, когда SMS-провайдер не подключён. */
export async function markNotificationSent(id: number): Promise<{ ok: boolean }> {
  await guard();
  await db
    .update(notifications)
    .set({ status: "sent", sentAt: new Date().toISOString().slice(0, 16).replace("T", " ") })
    .where(eq(notifications.id, id));
  revalidatePath("/admin/notifications");
  return { ok: true };
}

// Админ записывает клиента в свободное окно психолога (обычно по телефону).
export async function bookSlotForClient(
  requestId: number,
  slotId: number,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const result = await bookSlotForRequest(db, { slotId, clientRequestId: requestId });
  if (!result.ok) return result;

  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true };
}

export async function freeSlot(requestId: number, slotId: number): Promise<{ ok: boolean }> {
  await guard();
  await releaseSlot(db, slotId);
  revalidatePath(`/admin/requests/${requestId}`);
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
  grade?: number,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  // Одобрение без грейда невозможно: цена сессии определяется только грейдом,
  // и профиль без него показывал бы клиенту «стоимость уточняется».
  if (decision === "approved" && !isGrade(grade)) {
    return { ok: false, error: "Выберите грейд — от него зависит цена сессии" };
  }

  const [psy] = await db
    .select({ id: psychologists.id, name: psychologists.name, slug: psychologists.slug })
    .from(psychologists)
    .where(eq(psychologists.id, id));
  if (!psy) return { ok: false, error: "Заявка не найдена" };

  await db
    .update(psychologists)
    .set({
      moderationStatus: decision,
      moderationNotes: notes?.trim() || null,
      slug: decision === "approved" ? (psy.slug ?? slugify(psy.name, psy.id)) : psy.slug,
      needsReview: false,
      ...(decision === "approved" && isGrade(grade) ? { grade } : {}),
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
    detail:
      [decision === "approved" && isGrade(grade) && `грейд: ${gradeTitle(grade)}`, notes?.trim()]
        .filter(Boolean)
        .join(", ") || undefined,
  });
  revalidatePath(`/admin/psy/${id}`);
  revalidatePath("/admin/psy");
  revalidatePath("/");
  return { ok: true };
}
