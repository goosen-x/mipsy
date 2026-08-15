"use server";

import { randomUUID } from "node:crypto";
import { db, clientRequests } from "@/db";
import { currentAccount, linkAccount } from "@/lib/auth";
import { autoMatch, catalogUrlFor } from "@/lib/matching";
import { isCrisisAnswer, isValidPhone, normalizePhone } from "@/lib/rules";

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

export type AnketaResult =
  | { ok: true; matched: number; catalogUrl: string }
  | { ok: false; error: string };

export async function submitAnketa(payload: AnketaPayload): Promise<AnketaResult> {
  // Анкета доступна только из кабинета: почта уже подтверждена входом,
  // и заявка не может оказаться в чужом кабинете.
  const account = await currentAccount();
  if (!account) {
    return { ok: false, error: "Войдите в кабинет — подбор психолога запускается оттуда" };
  }

  const name = payload.name?.trim().slice(0, 200);
  // Телефон нужен для срочной связи: кризисные заявки и случаи, когда письмо
  // остаётся без ответа, — почтой не решаются.
  const phone = normalizePhone(payload.phone);
  if (!name) return { ok: false, error: "Укажите имя" };
  if (!isValidPhone(phone)) return { ok: false, error: "Проверьте номер телефона" };
  if (!payload.pdConsent) return { ok: false, error: "Нужно согласие на обработку данных" };
  // Возраст форма ограничивает, но серверу форма — не защита.
  const age = Number.isInteger(payload.age) && payload.age! >= 16 && payload.age! <= 100
    ? payload.age
    : null;

  // Имя и телефон аккаунта анкета уточняет (имя могло быть заглушкой из адреса).
  await linkAccount({ email: account.email, name, phone });

  const crisisFlag = isCrisisAnswer(payload.freqSelfHarm);
  const token = randomUUID();

  const [req] = await db.insert(clientRequests).values({
    clientToken: token,
    accountId: account.id,
    email: account.email,
    forWhom: "self",
    gender: payload.gender,
    age,
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
    story: payload.story?.trim().slice(0, 4000) || null,
    name,
    phone,
    pdConsent: true,
    crisisFlag,
    status: "new",
  }).returning({ id: clientRequests.id });

  // Сразу предлагаем до трёх подходящих специалистов. Если никто не подошёл,
  // заявка остаётся у админа — как раньше.
  const prefs = {
    topicSlugs: payload.topicSlugs ?? [],
    prefGender: payload.prefGender,
    prefAge: payload.prefAge,
  };
  // Кризисная анкета не уходит в самозапись: сначала приоритетный звонок
  // оператора, подбор — после разговора.
  const proposed = crisisFlag ? [] : await autoMatch(db, { clientRequestId: req.id, prefs });

  return { ok: true, matched: proposed.length, catalogUrl: catalogUrlFor(prefs) };
}
