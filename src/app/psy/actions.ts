"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { linkAccount, signIn } from "@/lib/auth";
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = payload.name?.trim();
  const phone = payload.phone?.replace(/[^\d+]/g, "") ?? "";
  const email = normalizeEmail(payload.email);
  if (!name) return { ok: false, error: "Укажите имя" };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Проверьте номер телефона" };
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты — по нему вы будете входить в кабинет" };
  if (!payload.education?.trim()) return { ok: false, error: "Расскажите об образовании" };

  const accountId = await linkAccount({ email, name, phone });
  if (!accountId) return { ok: false, error: "Проверьте адрес почты" };

  const [existing] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, accountId));
  if (existing) {
    await signIn(accountId);
    return { ok: false, error: "На эту почту уже есть заявка — войдите в кабинет" };
  }

  const token = randomUUID();
  await db.insert(psychologists).values({
    cabinetToken: token,
    accountId,
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

  await signIn(accountId);
  return { ok: true };
}
