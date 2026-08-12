import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { clientRequests, db, psychologists } from "@/db";

/**
 * Кабинеты открываются по секретной ссылке, но одной ссылки мало: она могла
 * попасть не тому человеку (переслали, общий компьютер, история браузера).
 * Поэтому с нового устройства просим код — он приходит на почту или телефон,
 * а после подтверждения ставим подписанную куку на 60 дней.
 *
 * Тот, кто только что сам создал заявку или профиль, подтверждён сразу:
 * владение доказано самим фактом создания.
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

function secret(): string {
  // Отдельного секрета не заводим: пароль оператора уже уникален для установки.
  return process.env.OPERATOR_PASSWORD ?? "mipsy-dev-secret";
}

function cookieName(kind: "me" | "cab", token: string): string {
  return `mipsy_${kind}_${token.slice(0, 8)}`;
}

function signature(kind: "me" | "cab", token: string): string {
  return createHmac("sha256", secret()).update(`${kind}:${token}`).digest("hex");
}

export async function grantAccess(kind: "me" | "cab", token: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(kind, token), signature(kind, token), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function hasAccess(kind: "me" | "cab", token: string): Promise<boolean> {
  const store = await cookies();
  const value = store.get(cookieName(kind, token))?.value;
  if (!value) return false;
  const expected = signature(kind, token);
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function newCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Куда отправлять код и как обращаться к человеку. */
export type CodeTarget = {
  name: string;
  phone: string;
  email: string | null;
  code: string;
};

export async function issueCode(kind: "me" | "cab", token: string): Promise<CodeTarget | null> {
  const code = newCode();
  if (kind === "me") {
    const [row] = await db
      .select({
        id: clientRequests.id,
        name: clientRequests.name,
        phone: clientRequests.phone,
        email: clientRequests.email,
      })
      .from(clientRequests)
      .where(eq(clientRequests.clientToken, token));
    if (!row) return null;
    await db.update(clientRequests).set({ accessCode: code }).where(eq(clientRequests.id, row.id));
    return { name: row.name, phone: row.phone, email: row.email, code };
  }

  const [row] = await db
    .select({
      id: psychologists.id,
      name: psychologists.name,
      phone: psychologists.phone,
      email: psychologists.email,
    })
    .from(psychologists)
    .where(eq(psychologists.cabinetToken, token));
  if (!row) return null;
  await db.update(psychologists).set({ accessCode: code }).where(eq(psychologists.id, row.id));
  return { name: row.name, phone: row.phone, email: row.email, code };
}

export async function checkCode(
  kind: "me" | "cab",
  token: string,
  code: string,
): Promise<boolean> {
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return false;

  if (kind === "me") {
    const [row] = await db
      .select({ id: clientRequests.id, accessCode: clientRequests.accessCode })
      .from(clientRequests)
      .where(eq(clientRequests.clientToken, token));
    if (!row?.accessCode || row.accessCode !== clean) return false;
    await db.update(clientRequests).set({ accessCode: null }).where(eq(clientRequests.id, row.id));
    return true;
  }

  const [row] = await db
    .select({ id: psychologists.id, accessCode: psychologists.accessCode })
    .from(psychologists)
    .where(eq(psychologists.cabinetToken, token));
  if (!row?.accessCode || row.accessCode !== clean) return false;
  await db.update(psychologists).set({ accessCode: null }).where(eq(psychologists.id, row.id));
  return true;
}
