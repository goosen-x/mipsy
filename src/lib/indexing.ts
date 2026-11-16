/**
 * Индексация сайта поисковиками. Пока сайт в разработке — закрыта целиком:
 * robots.txt «Disallow: /» и noindex на каждой странице. Открыть — переменной
 * окружения ALLOW_INDEXING=1 в /root/mipsy-run.sh, без правки кода.
 */
export const indexingAllowed = () => process.env.ALLOW_INDEXING === "1";

export const siteUrl = () => (process.env.SITE_URL ?? "https://psyo.ru").replace(/\/$/, "");

/** Разделы за входом и служебные — закрыты от поисковиков всегда. */
export const PRIVATE_PATHS = ["/admin", "/me", "/cab", "/login", "/anketa", "/psy/anketa", "/api", "/uploads", "/logout", "/demo"];
