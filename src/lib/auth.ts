import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { accounts, clientRequests, db, emailCodes, loginLog, psychologists } from "@/db";
import {
  accountPatch,
  checkCode,
  isEmail,
  normalizeEmail,
  nowDbTime,
  parseAdminEmails,
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
  // OPERATOR_PASSWORD — наследие общего пароля оператора: он подписывал сессии,
  // поэтому остаётся запасным вариантом, чтобы действующие входы не слетели.
  return process.env.SESSION_SECRET ?? process.env.OPERATOR_PASSWORD ?? "mipsy-dev-secret";
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
  const id = readSession(store.get(SESSION_COOKIE)?.value, secret());
  if (!id) return null;
  // Скрытый админом аккаунт разлогинен везде, даже с валидной кукой.
  const [row] = await db
    .select({ hidden: accounts.hidden })
    .from(accounts)
    .where(eq(accounts.id, id));
  return row && !row.hidden ? id : null;
}

/** Скрыт ли аккаунт с этой почтой. Наружу об этом никогда не сообщаем. */
export async function isEmailHidden(rawEmail: string): Promise<boolean> {
  const [row] = await db
    .select({ hidden: accounts.hidden })
    .from(accounts)
    .where(eq(accounts.email, normalizeEmail(rawEmail)));
  return Boolean(row?.hidden);
}

export type Account = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  isAdmin: boolean;
};

export async function currentAccount(): Promise<Account | null> {
  const id = await currentAccountId();
  if (!id) return null;
  const [row] = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      phone: accounts.phone,
      isAdmin: accounts.isAdmin,
    })
    .from(accounts)
    .where(eq(accounts.id, id));
  return row ?? null;
}

/**
 * Админ — обычный аккаунт с ролью: вход тот же, по коду с почты.
 * ADMIN_EMAILS даёт роль без записи в базе — так входит самый первый админ.
 */
export async function isAdmin(): Promise<boolean> {
  const account = await currentAccount();
  if (!account) return false;
  return account.isAdmin || parseAdminEmails(process.env.ADMIN_EMAILS).includes(account.email);
}

/**
 * Находит или заводит аккаунт по почте. Обычный путь создания — подтверждение
 * кода на /login; сюда без сессии попадает только админ, открывающий доступ
 * старой заявке. Владельцу сессии заодно уточняет имя и телефон.
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
    // Имя могло быть временным (часть адреса до @) — анкета или заявка его
    // уточняют, но только если её заполняет сам владелец кабинета.
    const patch = accountPatch({
      owned: (await currentAccountId()) === existing.id,
      existing,
      incoming: person,
    });
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

export async function accountExists(rawEmail: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, normalizeEmail(rawEmail)));
  return Boolean(row);
}

/**
 * Куда вести после входа: админа — в админку, у кого есть профиль
 * психолога — в кабинет специалиста, остальных — в кабинет клиента.
 */
export async function homePathFor(accountId: number): Promise<"/admin" | "/cab" | "/me"> {
  const [account] = await db
    .select({ email: accounts.email, isAdmin: accounts.isAdmin })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (
    account &&
    (account.isAdmin || parseAdminEmails(process.env.ADMIN_EMAILS).includes(account.email))
  ) {
    return "/admin";
  }

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
  const [pending] = await db.select().from(emailCodes).where(eq(emailCodes.email, email));

  const check = checkCode(pending, rawCode);
  if (!check.ok) {
    if (check.countAttempt && pending) {
      await db
        .update(emailCodes)
        .set({ attempts: pending.attempts + 1 })
        .where(eq(emailCodes.email, email));
    }
    return { ok: false, error: check.error, reason: check.reason };
  }

  await db.delete(emailCodes).where(eq(emailCodes.email, email));
  const link = await linkAccount({ email, name: email.split("@")[0] });
  if (!link) {
    return { ok: false, error: "Не получилось открыть кабинет", reason: "wrong_code" };
  }
  return { ok: true, accountId: link.id };
}

export type VerifyReason = "wrong_code" | "expired" | "blocked";

export type VerifyResult =
  | { ok: true; accountId: number }
  | { ok: false; error: string; reason: VerifyReason };

export async function verifyLoginCode(rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const [account] = await db
    .select({
      id: accounts.id,
      loginCode: accounts.loginCode,
      loginCodeSentAt: accounts.loginCodeSentAt,
      loginAttempts: accounts.loginAttempts,
    })
    .from(accounts)
    .where(eq(accounts.email, email));
  if (!account) {
    return { ok: false, error: "Неверный код — проверьте и попробуйте ещё раз", reason: "wrong_code" };
  }

  const check = checkCode(
    { code: account.loginCode, sentAt: account.loginCodeSentAt, attempts: account.loginAttempts },
    rawCode,
  );
  if (!check.ok) {
    if (check.countAttempt) {
      await db
        .update(accounts)
        .set({ loginAttempts: account.loginAttempts + 1 })
        .where(eq(accounts.id, account.id));
    }
    return { ok: false, error: check.error, reason: check.reason };
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
