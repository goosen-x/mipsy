"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { currentAccount, linkAccount } from "@/lib/auth";
import { isValidPhone, normalizePhone } from "@/lib/rules";

export type PsyApplication = {
  name: string;
  gender: string; // female | male
  birthYear: number | null;
  phone: string;
  education: string;
  educationDocs: string;
  experienceYears: number | null;
  supervision: string;
  personalTherapy: string;
};

export async function submitPsyApplication(
  payload: PsyApplication,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Заявка подаётся из-под входа: почта подтверждена, и заявка не может
  // оказаться привязанной к чужому адресу.
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Войдите на сайт — заявка подаётся после входа" };

  const name = payload.name?.trim();
  const phone = normalizePhone(payload.phone);
  if (!name) return { ok: false, error: "Укажите имя" };
  if (payload.gender !== "female" && payload.gender !== "male") {
    return { ok: false, error: "Укажите пол" };
  }
  const maxBirthYear = new Date().getFullYear() - 18;
  if (!payload.birthYear || payload.birthYear < 1930 || payload.birthYear > maxBirthYear) {
    return { ok: false, error: "Проверьте год рождения" };
  }
  if (!isValidPhone(phone)) return { ok: false, error: "Проверьте номер телефона" };
  if (!payload.education?.trim()) return { ok: false, error: "Расскажите об образовании" };

  const [existing] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, account.id));
  if (existing) {
    return { ok: false, error: "У вас уже есть заявка — она видна в кабинете специалиста, /cab" };
  }

  // Имя аккаунта могло быть заглушкой из адреса почты — заявка его уточняет.
  await linkAccount({ email: account.email, name, phone });

  const token = randomUUID();
  await db.insert(psychologists).values({
    cabinetToken: token,
    accountId: account.id,
    name,
    gender: payload.gender,
    birthYear: payload.birthYear,
    phone,
    email: account.email,
    education: payload.education.trim(),
    educationDocs: payload.educationDocs?.trim() || null,
    experienceYears: payload.experienceYears,
    supervision: payload.supervision?.trim() || null,
    personalTherapy: payload.personalTherapy?.trim() || null,
    moderationStatus: "new",
  });

  return { ok: true };
}
