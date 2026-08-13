import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Чистая часть входа: подпись сессии и правила кода. Живёт отдельно от базы и
 * куки, чтобы её можно было проверить тестами без Next.
 */

export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zа-я]{2,}$/i.test(normalizeEmail(value));
}

/** Кука сессии: «id.подпись». Подделать без секрета сервера нельзя. */
export function signSession(accountId: number, secret: string): string {
  const signature = createHmac("sha256", secret).update(`account:${accountId}`).digest("hex");
  return `${accountId}.${signature}`;
}

export function readSession(value: string | undefined | null, secret: string): number | null {
  if (!value) return null;
  const at = value.lastIndexOf(".");
  if (at < 1) return null;

  const accountId = Number(value.slice(0, at));
  if (!Number.isInteger(accountId) || accountId <= 0) return null;

  const given = Buffer.from(value.slice(at + 1));
  const expected = Buffer.from(signSession(accountId, secret).slice(String(accountId).length + 1));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? accountId : null;
}

/** Время в базе — UTC вида «YYYY-MM-DD HH:MM:SS»; ISO тоже принимаем. */
export function parseDbTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const ms = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export function nowDbTime(now: Date = new Date()): string {
  return now.toISOString().slice(0, 19).replace("T", " ");
}

export function codeIsFresh(sentAt: string | null | undefined, now: Date = new Date()): boolean {
  const ms = parseDbTime(sentAt);
  if (ms === null) return false;
  const age = now.getTime() - ms;
  return age >= 0 && age <= CODE_TTL_MINUTES * 60 * 1000;
}

export function cleanCode(code: string | null | undefined): string {
  return String(code ?? "").replace(/\D/g, "");
}

/**
 * Можно ли пускать в кабинет без кода после анкеты, заявки или брони.
 * Да — только если адрес нам незнаком (аккаунт создан прямо сейчас) или это
 * и есть текущая сессия. Иначе достаточно было бы вписать чужую почту, чтобы
 * попасть в чужой кабинет.
 */
export function mayAdoptSession(params: {
  created: boolean;
  accountId: number;
  sessionAccountId: number | null;
}): boolean {
  return params.created || params.sessionAccountId === params.accountId;
}

/** Показываем в интерфейсе, куда ушёл код, не раскрывая адрес целиком. */
export function maskEmail(email: string): string {
  const [name, domain] = normalizeEmail(email).split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}
