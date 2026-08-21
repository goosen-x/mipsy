import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, topics } from "@/db";
import { currentAccount } from "@/lib/auth";
import { AnketaWizard } from "./wizard";

export const metadata = { title: "Анкета — mipsy" };
export const dynamic = "force-dynamic";

export default async function AnketaPage() {
  // Анкета — шаг подбора из личного кабинета, а не отдельный вход на сайт:
  // сначала человек подтверждает почту, потом рассказывает о себе.
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fanketa");
  // Одна почта — один кабинет: со счёта специалиста подбор не запускается.
  // Объяснение ждёт в /cab, здесь незачем показывать анкету ради отказа.
  if (account.role === "psychologist") redirect("/cab");

  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  return (
    <AnketaWizard
      topics={topicList.map((t) => ({ slug: t.slug, title: t.title }))}
      email={account.email}
    />
  );
}
