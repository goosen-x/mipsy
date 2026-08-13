"use server";

import { randomUUID } from "node:crypto";
import { db, clientRequests } from "@/db";
import { linkAccount, signIn } from "@/lib/auth";
import { isEmail, normalizeEmail } from "@/lib/auth-core";

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
  email: string | null;
  pdConsent: boolean;
};

const FREQ = ["never", "seldom", "monthly", "weekly", "daily"];

export async function submitAnketa(
  payload: AnketaPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = payload.name?.trim();
  const email = normalizeEmail(payload.email);

  if (!name) return { ok: false, error: "Укажите имя" };
  // Почта обязательна: это вход в личный кабинет и адрес для писем о встречах.
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты — по нему вы будете входить в кабинет" };
  if (!payload.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  const accountId = await linkAccount({ email, name });
  if (!accountId) return { ok: false, error: "Проверьте адрес почты" };

  const crisisFlag =
    !!payload.freqSelfHarm && FREQ.indexOf(payload.freqSelfHarm) >= FREQ.indexOf("monthly");
  const token = randomUUID();

  await db.insert(clientRequests).values({
    clientToken: token,
    accountId,
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
    email,
    pdConsent: true,
    crisisFlag,
    status: "new",
  });

  await signIn(accountId);
  return { ok: true };
}
