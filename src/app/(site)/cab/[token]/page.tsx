import { redirect } from "next/navigation";
import { currentAccountId } from "@/lib/auth";

/** Старые ссылки на кабинет: доступа не дают, ведут на вход по почте. */
export const dynamic = "force-dynamic";

export default async function LegacyCabinetLink() {
  const accountId = await currentAccountId();
  redirect(accountId ? "/cab" : "/login?next=%2Fcab");
}
