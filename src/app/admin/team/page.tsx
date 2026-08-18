import { asc, eq } from "drizzle-orm";
import { accounts, db } from "@/db";
import { currentAccountId } from "@/lib/auth";
import { parseAdminEmails } from "@/lib/auth-core";
import { Badge } from "@/components/ui/badge";
import { TeamControls, RevokeButton } from "./controls";
import { requireAdmin } from "../require-admin";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireAdmin();

  const myId = await currentAccountId();
  const admins = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      lastLoginAt: accounts.lastLoginAt,
    })
    .from(accounts)
    .where(eq(accounts.isAdmin, true))
    .orderBy(asc(accounts.id));
  const envAdmins = parseAdminEmails(process.env.ADMIN_EMAILS).filter(
    (email) => !admins.some((a) => a.email === email),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Команда</h1>
      <p className="mt-2 text-neutral-600">
        Админы входят как все — по коду с почты. Роль можно выдать только аккаунту, который уже
        существует: каждое действие в админке записывается в журнал на имя.
      </p>

      <ul className="mt-6 space-y-2">
        {admins.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-sm"
          >
            <span className="font-medium">{a.name}</span>
            <span className="text-neutral-500">{a.email}</span>
            {a.lastLoginAt && (
              <span className="text-neutral-400">был(а) {a.lastLoginAt.slice(0, 16)}</span>
            )}
            <span className="ml-auto">
              {a.id === myId ? (
                <Badge variant="secondary">это вы</Badge>
              ) : (
                <RevokeButton accountId={a.id} email={a.email} />
              )}
            </span>
          </li>
        ))}
        {envAdmins.map((email) => (
          <li
            key={email}
            className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-sm"
          >
            <span className="text-neutral-500">{email}</span>
            <Badge variant="outline">из ADMIN_EMAILS</Badge>
            <span className="text-neutral-400">
              роль задана переменной окружения — убирается только на сервере
            </span>
          </li>
        ))}
        {admins.length === 0 && envAdmins.length === 0 && (
          <li className="text-neutral-500">
            Пока никого — вы здесь благодаря ADMIN_EMAILS. Выдайте роль своему аккаунту ниже.
          </li>
        )}
      </ul>

      <div className="mt-8 max-w-md rounded-2xl border border-neutral-100 p-6">
        <h2 className="font-bold">Добавить админа</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Человек должен хотя бы раз войти на сайт по коду — тогда у него есть аккаунт.
        </p>
        <div className="mt-4">
          <TeamControls />
        </div>
      </div>
    </div>
  );
}
