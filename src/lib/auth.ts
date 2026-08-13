import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { accounts, clientRequests, db, emailCodes, loginLog, psychologists } from "@/db";
import {
  MAX_CODE_ATTEMPTS,
  cleanCode,
  codeIsFresh,
  isEmail,
  mayAdoptSession,
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
export type LinkedAccount = { id: number; created: boolean };

export async function linkAccount(person: {
  email: string;
  name: string;
  phone?: string | null;
}): Promise<LinkedAccount | null> {
  const email = normalizeEmail(person.email);
  if (!isEmail(email)) return null;

  const [existing] = await db
    .select({ id: accounts.id, name: accounts.name, phone: accounts.phone })
    .from(accounts)
    .where(eq(accounts.email, email));

  if (existing) {
    // Имя могло быть временным (часть адреса до @) — анкета или заявка его уточняют.
    const name = person.name.trim();
    const patch: { phone?: string; name?: string } = {};
    if (!existing.phone && person.phone) patch.phone = person.phone;
    if (name && name !== existing.name) patch.name = name;
    if (Object.keys(patch).length > 0) {
      await db.update(accounts).set(patch).where(eq(accounts.id, existing.id));
    }
    return { id: existing.id, created: false };
  }

  const [created] = await db
    .insert(accounts)
    .values({ email, name: person.name.trim(), phone: person.phone ?? null })
    .returning({ id: accounts.id });
  return { id: created.id, created: true };
}

/**
 * Выдаёт сессию после анкеты, заявки или брони — но только тому, кто имеет на
 * неё право. Если почта чужая и уже занята, человек увидит просьбу войти по коду.
 */
export async function adoptSession(link: LinkedAccount): Promise<boolean> {
  const allowed = mayAdoptSession({
    created: link.created,
    accountId: link.id,
    sessionAccountId: await currentAccountId(),
  });
  if (allowed) await signIn(link.id);
  return allowed;
}

export async function accountExists(rawEmail: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, normalizeEmail(rawEmail)));
  return Boolean(row);
}

/** Куда вести после входа: у кого есть профиль психолога — в кабинет специалиста. */
export async function homePathFor(accountId: number): Promise<"/cab" | "/me"> {
  const [psy] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, accountId));
  return psy ? "/cab" : "/me";
}

/** Сколько писем с кодом можно отправить на один адрес за час. */
const CODES_PER_HOUR = 5;

/**
 * Защита чужого почтового ящика: кто угодно может ввести чужой адрес, поэтому
 * ограничиваем частоту писем на адрес. Считаем по журналу входов.
 */
export async function codeRequestsThrottled(email: string): Promise<boolean> {
  const hourAgo = nowDbTime(new Date(Date.now() - 60 * 60 * 1000));
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginLog)
    .where(
      and(
        eq(loginLog.email, email),
        gt(loginLog.createdAt, hourAgo),
        // Считаем именно запросы: если письмо не ушло из-за сбоя SMTP,
        // это не повод разрешить ещё сотню попыток.
        inArray(loginLog.outcome, ["sent", "sent_unknown", "delivery_failed"]),
      ),
    );
  return (row?.count ?? 0) >= CODES_PER_HOUR;
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

/**
 * Код для адреса, которого у нас нет. Отправляем его так же, как обычный, —
 * снаружи два случая неразличимы (паттерн sign-in-or-up: сначала человек
 * подтверждает владение почтой, и только потом решается, вход это или анкета).
 */
export async function issueSignupCode(rawEmail: string): Promise<string | null> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return null;

  const code = String(randomInt(100000, 1000000));
  await db
    .insert(emailCodes)
    .values({ email, code, sentAt: nowDbTime(), attempts: 0 })
    .onConflictDoUpdate({
      target: emailCodes.email,
      set: { code, sentAt: nowDbTime(), attempts: 0 },
    });
  // Просроченные коды не храним.
  await db.delete(emailCodes).where(lt(emailCodes.sentAt, nowDbTime(new Date(Date.now() - 86400000))));
  return code;
}

/**
 * Проверка кода для нового человека. При успехе заводим аккаунт: имя пока
 * неизвестно, его перезапишет анкета или заявка психолога.
 */
export async function verifySignupCode(
  rawEmail: string,
  rawCode: string,
): Promise<{ ok: true; accountId: number } | { ok: false; error: string; reason: VerifyReason }> {
  const email = normalizeEmail(rawEmail);
  const code = cleanCode(rawCode);
  const wrong = {
    ok: false,
    error: "Неверный код — проверьте и попробуйте ещё раз",
    reason: "wrong_code",
  } as const;

  const [pending] = await db.select().from(emailCodes).where(eq(emailCodes.email, email));
  if (!pending || code.length !== 6) return wrong;

  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "Слишком много попыток. Запросите новый код.", reason: "blocked" };
  }
  if (!codeIsFresh(pending.sentAt)) {
    return { ok: false, error: "Код устарел — запросите новый.", reason: "expired" };
  }
  if (pending.code !== code) {
    await db
      .update(emailCodes)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(emailCodes.email, email));
    return wrong;
  }

  await db.delete(emailCodes).where(eq(emailCodes.email, email));
  const link = await linkAccount({ email, name: email.split("@")[0] });
  if (!link) return { ...wrong, error: "Не получилось открыть кабинет" };
  return { ok: true, accountId: link.id };
}

export type VerifyReason = "wrong_code" | "expired" | "blocked";

export type VerifyResult =
  | { ok: true; accountId: number }
  | { ok: false; error: string; reason: VerifyReason };

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
