/**
 * Правила платформы, от которых зависит безопасность клиента и целостность
 * сервиса. Чистые функции без базы и Next — одни и те же в анкете, кабинете
 * психолога и тестах. Раньше каждое правило жило копиями в трёх местах.
 */

import { parsePhoneNumberFromString, validatePhoneNumberLength } from "libphonenumber-js";

/** Шкала частоты из скрининга анкеты — по возрастанию тяжести. */
export const FREQ_SCALE = ["never", "seldom", "monthly", "weekly", "daily"] as const;

/** Кризисный флаг: мысли о самоповреждении «несколько раз в месяц» и чаще. */
export function isCrisisAnswer(answer: string | null | undefined): boolean {
  if (!answer) return false;
  return FREQ_SCALE.indexOf(answer as (typeof FREQ_SCALE)[number]) >= FREQ_SCALE.indexOf("monthly");
}

// Телефоны, @-контакты и ссылки на мессенджеры в публичном профиле запрещены:
// вся связь идёт через платформу.
const CONTACT_RE = /(\+?\d[\d\s\-()]{8,})|@\w{2,}|(t\.me|wa\.me|vk\.com|instagram\.com)/i;

export function containsContacts(text: string): boolean {
  return CONTACT_RE.test(text);
}

/** Публичные поля профиля психолога одной строкой — для проверки на контакты. */
export function publicProfileText(profile: {
  about?: string | null;
  howSessions?: string | null;
  approach?: string | null;
  faq?: { q: string; a: string }[] | null;
}): string {
  return [
    profile.about,
    profile.howSessions,
    profile.approach,
    ...(profile.faq ?? []).flatMap((f) => [f.q, f.a]),
  ]
    .filter(Boolean)
    .join(" ");
}

export const CONTACTS_ERROR =
  "Похоже, в тексте профиля есть телефон, ссылка или @-контакт. Уберите их, пожалуйста — вся связь с клиентами идёт через платформу.";

/** Оставляет в номере только цифры и «+» — так телефон хранится в базе. */
/**
 * Телефон в формате E.164 (+79001234567). Номер без кода страны считаем
 * российским: «8 900…» и «900…» тоже приводятся к +7. Непарсящийся ввод
 * возвращается как есть, без мусора, — его отсечёт isValidPhone.
 */
export function normalizePhone(raw: string | null | undefined): string {
  const parsed = parsePhoneNumberFromString(raw ?? "", "RU");
  return parsed?.number ?? (raw ?? "").replace(/[^\d+]/g, "");
}

/**
 * Что не так с номером — для подсказки под полем; null, если номер верный.
 * Отличаем «не хватает цифр» от «лишних»: раньше на лишние цифры поле честно
 * говорило «не хватает», и человек не понимал, что исправлять.
 */
export function phoneProblem(raw: string | null | undefined): string | null {
  if (isValidPhone(raw)) return null;
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "Введите номер телефона";
  const length = validatePhoneNumberLength(raw ?? "", "RU");
  if (length === "TOO_SHORT") return "Не хватает цифр";
  if (length === "TOO_LONG" || length === "INVALID_LENGTH") {
    // У RU номер всегда 10 цифр после +7: больше — значит лишние.
    const national = parsePhoneNumberFromString(raw ?? "", "RU")?.nationalNumber ?? "";
    return national.length > 10 || length === "TOO_LONG" ? "Лишние цифры — проверьте номер" : "Неверная длина номера";
  }
  return "Такого номера не бывает — проверьте код оператора";
}

/** Настоящий номер по правилам страны (libphonenumber), а не «есть десять цифр». */
export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw || /[a-zа-яё]/i.test(raw)) return false;
  return parsePhoneNumberFromString(raw, "RU")?.isValid() ?? false;
}

// Модерация психолога: draft (только зарегистрировался) → new (приложил
// образование и документы) → approved | rejected.

/** Одобрить можно только заявку с образованием и документами: черновик
 * модерация ещё не видела, опубликовать его значит пропустить проверку дипломов. */
export function canApprove(status: string): boolean {
  return status !== "draft";
}

/** Наши загрузки: /uploads/<uuid>.<ext>. Произвольные ссылки в заявку не попадают. */
export function onlyOwnUploads(urls: readonly string[] | null | undefined): string[] {
  return (urls ?? []).filter((u) => /^\/uploads\/[a-f0-9-]{36}\.\w{3,4}$/.test(u));
}

/** Что станет со статусом, когда психолог сохраняет образование и документы.
 * Черновик и отклонённая заявка уходят на (повторную) модерацию; одобренный
 * профиль остаётся опубликованным, но помечается для вычитки оператором. */
export function afterEducationSubmit(status: string): {
  moderationStatus: string;
  needsReview: boolean;
} {
  if (status === "draft" || status === "rejected") return { moderationStatus: "new", needsReview: false };
  return { moderationStatus: status, needsReview: status === "approved" };
}
