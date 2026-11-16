import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { clientRequests, db, topics } from "@/db";
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

  // Подбор уже идёт — вторая анкета завела бы новую заявку и подменила
  // подборку в кабинете. Кнопки «Подобрать психолога» ведут сюда и тех, кто
  // анкету уже прошёл (вход через /login?next=/anketa), поэтому решаем здесь.
  // Новую анкету можно начать только после отказа по прошлой заявке.
  const [last] = await db
    .select({ status: clientRequests.status })
    .from(clientRequests)
    .where(eq(clientRequests.accountId, account.id))
    .orderBy(desc(clientRequests.id))
    .limit(1);
  if (last && last.status !== "rejected") redirect("/me");

  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  return (
    <AnketaWizard
      topics={topicList.map((t) => ({ slug: t.slug, title: t.title }))}
      email={account.email}
    />
  );
}
