/**
 * Правила платформы, от которых зависит безопасность клиента и целостность
 * сервиса. Чистые функции без базы и Next — одни и те же в анкете, кабинете
 * психолога и тестах. Раньше каждое правило жило копиями в трёх местах.
 */

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
export function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^\d+]/g, "");
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw).replace(/\D/g, "").length >= 10;
}
