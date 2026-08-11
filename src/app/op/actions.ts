"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { clientRequests, db, matches, psychologists, sessions } from "@/db";
import { isOperator, OP_COOKIE, opPasswordHash } from "@/lib/op-auth";

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
  data: { status?: string; operatorNotes?: string },
): Promise<{ ok: boolean }> {
  await guard();
  await db
    .update(clientRequests)
    .set({
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.operatorNotes !== undefined ? { operatorNotes: data.operatorNotes } : {}),
    })
    .where(eq(clientRequests.id, id));
  revalidatePath(`/op/requests/${id}`);
  revalidatePath("/op");
  return { ok: true };
}

// Подбор: деактивирует прежнюю привязку (переподбор) и создаёт новую.
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

  await db
    .update(matches)
    .set({ active: false })
    .where(and(eq(matches.clientRequestId, requestId), eq(matches.active, true)));
  await db.insert(matches).values({
    clientRequestId: requestId,
    psychologistId,
    note: note?.trim() || null,
  });
  await db.update(clientRequests).set({ status: "matched" }).where(eq(clientRequests.id, requestId));
  revalidatePath(`/op/requests/${requestId}`);
  revalidatePath("/op");
  return { ok: true };
}

export async function addSession(
  matchId: number,
  scheduledAt: string,
  isIntroCall: boolean,
): Promise<{ ok: boolean }> {
  await guard();
  await db.insert(sessions).values({
    matchId,
    scheduledAt: scheduledAt?.trim() || null,
    isIntroCall,
  });
  revalidatePath("/op");
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
    })
    .where(eq(psychologists.id, id));
  revalidatePath(`/op/psy/${id}`);
  revalidatePath("/op/psy");
  revalidatePath("/");
  return { ok: true };
}
