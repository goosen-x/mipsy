"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { db, supportTickets } from "@/db";
import { isEmail } from "@/lib/auth-core";

/**
 * Публичное обращение в поддержку — без входа: канал для тех, кто как раз
 * войти и не может. Троттлинг по адресу как у кодов входа (5 в час), плюс
 * honeypot-поле от простых ботов.
 */
export async function createGuestTicket(params: {
  name: string;
  email: string;
  body: string;
  website?: string; // honeypot: у людей всегда пусто
}): Promise<{ ok: boolean; error?: string }> {
  if (params.website) return { ok: true }; // бота молча «принимаем»

  const name = String(params.name ?? "").trim().slice(0, 200);
  const email = String(params.email ?? "").trim().toLowerCase();
  const body = String(params.body ?? "").trim().slice(0, 4000);
  if (name.length < 2) return { ok: false, error: "Представьтесь, пожалуйста" };
  if (!isEmail(email)) return { ok: false, error: "Проверьте адрес почты — на него придёт ответ" };
  if (body.length < 10) return { ok: false, error: "Опишите вопрос чуть подробнее" };

  const [recent] = await db
    .select({ n: sql<number>`count(*)` })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.email, email),
        gt(supportTickets.createdAt, sql`datetime('now', '-1 hour')`),
      ),
    );
  if ((recent?.n ?? 0) >= 5) {
    return { ok: false, error: "Слишком много обращений подряд — мы уже читаем предыдущие" };
  }

  await db.insert(supportTickets).values({
    fromRole: "guest",
    kind: "question",
    name,
    email,
    body,
  });
  return { ok: true };
}
