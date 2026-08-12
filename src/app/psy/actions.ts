"use server";

import { randomUUID } from "node:crypto";
import { db, psychologists } from "@/db";
import { grantAccess } from "@/lib/access";

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
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const name = payload.name?.trim();
  const phone = payload.phone?.replace(/[^\d+]/g, "") ?? "";
  if (!name) return { ok: false, error: "Укажите имя" };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Проверьте номер телефона" };
  if (!payload.education?.trim()) return { ok: false, error: "Расскажите об образовании" };

  const token = randomUUID();
  await db.insert(psychologists).values({
    cabinetToken: token,
    name,
    phone,
    email: payload.email?.trim() || null,
    education: payload.education.trim(),
    educationDocs: payload.educationDocs?.trim() || null,
    experienceYears: payload.experienceYears,
    supervision: payload.supervision?.trim() || null,
    personalTherapy: payload.personalTherapy?.trim() || null,
    moderationStatus: "new",
  });

  await grantAccess("cab", token);
  return { ok: true, token };
}
