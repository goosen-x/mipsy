"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { adoptSession, linkAccount } from "@/lib/auth";
import { isEmail, normalizeEmail } from "@/lib/auth-core";

export type PsyApplication = {
  name: string;
  phone: string;
  email: string;
  education: string;
  educationDocs: string;
  experienceYears: number | null;
  supervision: string;
  personalTherapy: string;
};

export async function submitPsyApplication(
  payload: PsyApplication,
): Promise<{ ok: true; needsLogin: boolean } | { ok: false; error: string }> {
  const name = payload.name?.trim();
  const phone = payload.phone?.replace(/[^\d+]/g, "") ?? "";
  const email = normalizeEmail(payload.email);
  if (!name) return { ok: false, error: "Укажите имя" };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Проверьте номер телефона" };
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты — по нему вы будете входить в кабинет" };
  if (!payload.education?.trim()) return { ok: false, error: "Расскажите об образовании" };

  const account = await linkAccount({ email, name, phone });
  if (!account) return { ok: false, error: "Проверьте адрес почты" };

  const [existing] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, account.id));
  if (existing) {
    return {
      ok: false,
      error: "На эту почту уже есть заявка. Войдите в кабинет по коду с почты — /login",
    };
  }

  const token = randomUUID();
  await db.insert(psychologists).values({
    cabinetToken: token,
    accountId: account.id,
    name,
    phone,
    email,
    education: payload.education.trim(),
    educationDocs: payload.educationDocs?.trim() || null,
    experienceYears: payload.experienceYears,
    supervision: payload.supervision?.trim() || null,
    personalTherapy: payload.personalTherapy?.trim() || null,
    moderationStatus: "new",
  });

  const signedIn = await adoptSession(account);
  return { ok: true, needsLogin: !signedIn };
}
