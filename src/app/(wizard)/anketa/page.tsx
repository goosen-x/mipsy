import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, topics } from "@/db";
import { currentAccount } from "@/lib/auth";
import { DEMO_ACCOUNT, readDemoState } from "@/app/(site)/me/demo";
import { hasUpcomingBooking, lastRequestOf } from "@/lib/client-requests";
import { AnketaWizard } from "./wizard";

export const metadata = { title: "Анкета — mipsy" };
export const dynamic = "force-dynamic";

export default async function AnketaPage({
  searchParams,
}: {
  searchParams: Promise<{ retake?: string }>;
}) {
  const retake = (await searchParams).retake === "1";
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const topicOptions = topicList.map((t) => ({ slug: t.slug, title: t.title }));

  // Демо кабинета (/demo): повторную анкету можно пройти, отправка не сохраняется.
  if (retake && (await readDemoState())) {
    return (
      <AnketaWizard topics={topicOptions} email={DEMO_ACCOUNT.email} retakeName={DEMO_ACCOUNT.name} />
    );
  }

  // Анкета — шаг подбора из личного кабинета, а не отдельный вход на сайт:
  // сначала человек подтверждает почту, потом рассказывает о себе.
  const account = await currentAccount();
  if (!account) redirect("/login?next=%2Fanketa");
  // Одна почта — один кабинет: со счёта специалиста подбор не запускается.
  // Объяснение ждёт в /cab, здесь незачем показывать анкету ради отказа.
  if (account.role === "psychologist") redirect("/cab");

  const last = await lastRequestOf(account.id);

  // Подбор уже идёт — кнопки «Подобрать психолога» ведут сюда и тех, кто
  // анкету уже прошёл (вход через /login?next=/anketa), поэтому решаем здесь.
  // Новая анкета — после отказа по прошлой заявке или осознанно, кнопкой
  // «Пройти анкету заново» в кабинете (?retake=1). Повторная не начинается,
  // пока впереди встреча: её сначала отменяют в кабинете.
  if (last && last.status !== "rejected" && !retake) redirect("/me");
  if (last && retake && (await hasUpcomingBooking(account.id))) redirect("/me/podbor");

  return (
    <AnketaWizard
      topics={topicOptions}
      email={account.email}
      // Повторная анкета не спрашивает заново имя, телефон, пол, возраст и согласия.
      retakeName={last && retake ? last.name : null}
    />
  );
}
