import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { currentAccount } from "@/lib/auth";
import { PsyApplicationWizard } from "./wizard";

export const metadata = { title: "Заявка психолога — mipsy" };
export const dynamic = "force-dynamic";

export default async function PsyAnketaPage() {
  // Заявка — за входом: почта подтверждена, заявка не привяжется к чужому адресу.
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fpsy%2Fanketa");

  // Повторная заявка не нужна — у этого аккаунта уже есть кабинет специалиста.
  const [existing] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.accountId, account.id));
  if (existing) redirect("/cab");

  return <PsyApplicationWizard email={account.email} />;
}
