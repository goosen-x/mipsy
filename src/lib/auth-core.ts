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
  const email = normalizeEmail(value);
  // 254 — предел RFC; без него в базу попадают «адреса»-простыни.
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-zа-я]{2,}$/i.test(email);
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

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: "wrong_code" | "expired" | "blocked"; error: string; countAttempt: boolean };

/**
 * Единая проверка шестизначного кода — и для входа, и для новой почты.
 * Порядок важен: сначала лимит попыток, потом срок, потом сравнение —
 * перебор блокируется до того, как что-то узнает о коде.
 */
export function checkCode(
  pending: { code: string | null; sentAt: string | null; attempts: number } | null | undefined,
  rawCode: string | null | undefined,
  now: Date = new Date(),
): CodeCheck {
  const code = cleanCode(rawCode);
  const wrong = {
    ok: false,
    reason: "wrong_code",
    error: "Неверный код — проверьте и попробуйте ещё раз",
    countAttempt: false,
  } as const;

  if (!pending || code.length !== 6) return wrong;
  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    return {
      ok: false,
      reason: "blocked",
      error: "Слишком много попыток. Запросите новый код.",
      countAttempt: false,
    };
  }
  if (!pending.code || !codeIsFresh(pending.sentAt, now)) {
    return { ok: false, reason: "expired", error: "Код устарел — запросите новый.", countAttempt: false };
  }
  if (pending.code !== code) return { ...wrong, countAttempt: true };
  return { ok: true };
}

/**
 * Что можно обновить в существующем аккаунте по данным из анкеты или заявки.
 * Только владельцу сессии: иначе достаточно вписать чужую почту в форму,
 * чтобы переименовать чужой аккаунт или дописать в него свой телефон.
 */
export function accountPatch(params: {
  owned: boolean;
  existing: { name: string; phone: string | null };
  incoming: { name: string; phone?: string | null };
}): { name?: string; phone?: string } {
  if (!params.owned) return {};
  const patch: { name?: string; phone?: string } = {};
  const name = params.incoming.name.trim();
  if (name && name !== params.existing.name) patch.name = name;
  if (!params.existing.phone && params.incoming.phone) patch.phone = params.incoming.phone;
  return patch;
}

/**
 * Бутстрап админов: список почт из переменной окружения ADMIN_EMAILS.
 * Нужен, чтобы первый админ мог войти в пустую базу; дальше роли живут
 * на аккаунтах и раздаются со страницы «Команда».
 */
export function parseAdminEmails(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter((e) => isEmail(e));
}

/** Показываем в интерфейсе, куда ушёл код, не раскрывая адрес целиком. */
export function maskEmail(email: string): string {
  const [name, domain] = normalizeEmail(email).split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}
