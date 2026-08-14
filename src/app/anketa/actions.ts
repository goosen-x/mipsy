"use server";

import { randomUUID } from "node:crypto";
import { db, clientRequests } from "@/db";
import { currentAccount, linkAccount } from "@/lib/auth";
import { isCrisisAnswer } from "@/lib/rules";

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
  pdConsent: boolean;
};

export async function submitAnketa(
  payload: AnketaPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Анкета доступна только из кабинета: почта уже подтверждена входом,
  // и заявка не может оказаться в чужом кабинете.
  const account = await currentAccount();
  if (!account) {
    return { ok: false, error: "Войдите в кабинет — подбор психолога запускается оттуда" };
  }

  const name = payload.name?.trim();
  if (!name) return { ok: false, error: "Укажите имя" };
  if (!payload.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };

  // Имя аккаунта могло быть заглушкой из адреса почты — анкета его уточняет.
  await linkAccount({ email: account.email, name });

  const crisisFlag = isCrisisAnswer(payload.freqSelfHarm);
  const token = randomUUID();

  await db.insert(clientRequests).values({
    clientToken: token,
    accountId: account.id,
    email: account.email,
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
    pdConsent: true,
    crisisFlag,
    status: "new",
  });

  return { ok: true };
}
