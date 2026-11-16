import { redirect } from "next/navigation";
import { currentAccountId } from "@/lib/auth";

/**
 * Старые письма и приглашения ведут на /me/<token>. Сам токен доступа больше
 * не даёт: вошедшего отправляем в кабинет, остальных — на форму входа.
 */
export const dynamic = "force-dynamic";

export default async function LegacyClientLink() {
  const accountId = await currentAccountId();
  redirect(accountId ? "/me" : "/login?next=%2Fme");
}
