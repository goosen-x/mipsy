"use server";

import { db, clientRequests } from "@/db";

export type AnketaPayload = {
  forWhom: "self";
  gender: string | null;
  age: number | null;
  therapyExperience: string | null;
  mainProblem: string | null;
  topicSlugs: string[];
  topicOther: string | null;
  freqDown: string | null;
  freqSleep: string | null;
  freqSelfHarm: string | null;
  lifeImpact: string | null;
  prefGender: string | null;
  prefAge: string | null;
  preferredTime: string[];
  story: string | null;
  name: string;
  phone: string;
  pdConsent: boolean;
};

const FREQ = ["never", "seldom", "monthly", "weekly", "daily"];

export async function submitAnketa(payload: AnketaPayload): Promise<{ ok: boolean; error?: string }> {
  const name = payload.name?.trim();
  const phone = payload.phone?.replace(/[^\d+]/g, "") ?? "";

  if (!name) return { ok: false, error: "Укажите имя" };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Проверьте номер телефона" };
  if (!payload.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  const crisisFlag =
    !!payload.freqSelfHarm && FREQ.indexOf(payload.freqSelfHarm) >= FREQ.indexOf("monthly");

  await db.insert(clientRequests).values({
    forWhom: "self",
    gender: payload.gender,
    age: payload.age,
    therapyExperience: payload.therapyExperience,
    mainProblem: payload.mainProblem,
    topicSlugs: payload.topicSlugs ?? [],
    topicOther: payload.topicOther?.trim() || null,
    freqDown: payload.freqDown,
    freqSleep: payload.freqSleep,
    freqSelfHarm: payload.freqSelfHarm,
    lifeImpact: payload.lifeImpact,
    prefGender: payload.prefGender,
    prefAge: payload.prefAge,
    preferredTime: payload.preferredTime ?? [],
    story: payload.story?.trim() || null,
    name,
    phone,
    pdConsent: true,
    crisisFlag,
    status: "new",
  });

  return { ok: true };
}
