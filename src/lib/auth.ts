import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { accounts, clientRequests, db, psychologists } from "@/db";
import {
  MAX_CODE_ATTEMPTS,
  cleanCode,
  codeIsFresh,
  isEmail,
  normalizeEmail,
  nowDbTime,
  readSession,
  signSession,
} from "./auth-core";

/**
 * Вход в личный кабинет: человек вводит почту, получает письмом код, дальше
 * живёт сессия. Секретных ссылок больше нет — старые ведут на форму входа.
 */

const SESSION_COOKIE = "mipsy_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 дней

function secret(): string {
  // Отдельного секрета не заводим: пароль оператора уже уникален для установки.
  return process.env.OPERATOR_PASSWORD ?? "mipsy-dev-secret";
}

export async function signIn(accountId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(accountId, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  await db
    .update(accounts)
    .set({ lastLoginAt: nowDbTime(), loginCode: null, loginAttempts: 0 })
    .where(eq(accounts.id, accountId));
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function currentAccountId(): Promise<number | null> {
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value, secret());
}

export type Account = { id: number; email: string; name: string; phone: string | null };

export async function currentAccount(): Promise<Account | null> {
  const id = await currentAccountId();
  if (!id) return null;
  const [row] = await db
    .select({ id: accounts.id, email: accounts.email, name: accounts.name, phone: accounts.phone })
    .from(accounts)
    .where(eq(accounts.id, id));
  return row ?? null;
}

/**
 * Аккаунт заводится в момент первого обращения — отдельной регистрации нет:
 * анкета, заявка психолога и запись из каталога и есть регистрация.
 */
export async function linkAccount(person: {
  email: string;
  name: string;
  phone?: string | null;
}): Promise<number | null> {
  const email = normalizeEmail(person.email);
  if (!isEmail(email)) return null;

  const [existing] = await db
    .select({ id: accounts.id, phone: accounts.phone })
    .from(accounts)
    .where(eq(accounts.email, email));

  if (existing) {
    if (!existing.phone && person.phone) {
      await db.update(accounts).set({ phone: person.phone }).where(eq(accounts.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(accounts)
    .values({ email, name: person.name.trim(), phone: person.phone ?? null })
    .returning({ id: accounts.id });
  return created.id;
}

/** Куда вести после входа: у кого есть профиль психолога — в кабинет специалиста. */
export async function homePathFor(accountId: number): Promise<"/cab" | "/me"> {
  const [psy] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, accountId));
  return psy ? "/cab" : "/me";
}

export type IssuedCode = {
  accountId: number;
  email: string;
  name: string;
  phone: string | null;
  code: string;
};

/** Возвращает null, если аккаунта нет: наружу об этом не сообщаем. */
export async function issueLoginCode(rawEmail: string): Promise<IssuedCode | null> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return null;

  const [account] = await db
    .select({ id: accounts.id, name: accounts.name, phone: accounts.phone })
    .from(accounts)
    .where(eq(accounts.email, email));
  if (!account) return null;

  const code = String(randomInt(100000, 1000000));
  await db
    .update(accounts)
    .set({ loginCode: code, loginCodeSentAt: nowDbTime(), loginAttempts: 0 })
    .where(eq(accounts.id, account.id));

  return { accountId: account.id, email, name: account.name, phone: account.phone, code };
}

export type VerifyResult =
  | { ok: true; accountId: number }
  | { ok: false; error: string; reason: "wrong_code" | "expired" | "blocked" };

export async function verifyLoginCode(rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = cleanCode(rawCode);
  const wrong = {
    ok: false,
    error: "Неверный код — проверьте и попробуйте ещё раз",
    reason: "wrong_code",
  } as const;

  const [account] = await db
    .select({
      id: accounts.id,
      loginCode: accounts.loginCode,
      loginCodeSentAt: accounts.loginCodeSentAt,
      loginAttempts: accounts.loginAttempts,
    })
    .from(accounts)
    .where(eq(accounts.email, email));
  if (!account || code.length !== 6) return wrong;

  if (account.loginAttempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "Слишком много попыток. Запросите новый код.", reason: "blocked" };
  }
  if (!account.loginCode || !codeIsFresh(account.loginCodeSentAt)) {
    return { ok: false, error: "Код устарел — запросите новый.", reason: "expired" };
  }
  if (account.loginCode !== code) {
    await db
      .update(accounts)
      .set({ loginAttempts: account.loginAttempts + 1 })
      .where(eq(accounts.id, account.id));
    return wrong;
  }

  return { ok: true, accountId: account.id };
}

/** Заявки клиента — свежая первой. Обращений может быть несколько. */
export async function accountRequestIds(accountId: number): Promise<number[]> {
  const rows = await db
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(eq(clientRequests.accountId, accountId))
    .orderBy(desc(clientRequests.id));
  return rows.map((r) => r.id);
}
