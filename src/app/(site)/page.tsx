import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  IconArrowRight,
  IconCircleCheck,
  IconDeviceLaptop,
  IconLock,
  IconReceipt,
} from "@tabler/icons-react";
import { db, psychologists, reviews, slots, topics } from "@/db";
import { currentAccountId, homePathFor } from "@/lib/auth";
import { GRADES } from "@/lib/grades";
import { loadShowcase } from "@/components/psy-showcase/data";
import { PsyShowcase } from "@/components/psy-showcase/section";
import { Button } from "@/components/ui/button";
import { FaqList } from "@/components/faq-list";
import {
  HowSection,
  PricesSection,
  SelectionSection,
} from "@/components/home-sections";
import { CLIENT_FAQ } from "@/content/faq";

export const revalidate = 60;

// Анкета пока одна для всех: карточки ведут в подбор, а не в разные сценарии.
const AUDIENCES = [
  { title: "Для себя", text: "Поможем найти решение" },
  { title: "Для пары", text: "Поможем наладить отношения" },
  { title: "Для ребенка", text: "Поможем пережить трудный период" },
];

const REQUESTS = [
  {
    title: "Тревога и стресс",
    text: "Сложно расслабиться, тревога мешает жить и работать",
  },
  { title: "Выгорание", text: "Потеря сил и мотивации, работа на автомате" },
  {
    title: "Отношения",
    text: "Конфликты и недопонимание с партнером, семьей, детьми",
  },
  {
    title: "Самооценка",
    text: "Сложно принимать решения, страх ошибиться, самокритика",
  },
  {
    title: "Личные кризисы",
    text: "Переезд, смена работы, потеря, взросление",
    wide: true,
  },
  {
    title: "Карьера",
    text: "Поиск себя в профессии, смена сферы, выгорание в карьере",
    wide: true,
  },
];

const MIN_PRICE = Math.min(
  ...Object.values(GRADES).map((g) => g.price),
).toLocaleString("ru-RU");

export default async function Home() {
  const accountId = await currentAccountId();
  const cabinet = accountId ? await homePathFor(accountId) : null;
  // Подбор начинается с анкеты; без входа — через вход и сразу в анкету.
  const startHref = accountId ? "/anketa" : "/login?next=%2Fanketa";

  const showcase = await loadShowcase();

  const latestReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      authorName: reviews.authorName,
      psyName: psychologists.name,
    })
    .from(reviews)
    .innerJoin(psychologists, eq(reviews.psychologistId, psychologists.id))
    .where(eq(reviews.status, "published"))
    .orderBy(desc(reviews.createdAt))
    .limit(6);

  return (
    <>
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-12 lg:grid-cols-[1.3fr_1fr] lg:pt-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-300 px-3 py-1.5 text-sm text-neutral-700">
              <IconCircleCheck size={18} className="text-brand-600" />
              Каждый психолог проходит проверку: диплом, опыт и супервизии
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl xl:text-[3.5rem]">
              Онлайн-консультации
              <br />
              <span className="text-brand-600">с психологом</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-neutral-600">
              Ответьте на несколько вопросов — подберем специалиста,
              который сможет вам помочь
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-brand-600 px-7 text-base text-white hover:bg-brand-700"
              >
                <Link href={startHref}>Подобрать психолога</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl px-7 text-base"
              >
                <Link href="/psihologi">Смотреть каталог</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            {AUDIENCES.map((a) => (
              <Link
                key={a.title}
                href={startHref}
                className="group flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-neutral-100 px-6 py-5 transition-colors hover:bg-brand-50"
              >
                <div>
                  <div className="text-lg font-semibold">{a.title}</div>
                  <div className="text-neutral-500">{a.text}</div>
                </div>
                <IconArrowRight
                  size={24}
                  className="shrink-0 text-brand-600 transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>
        </section>

        {/* Преимущества */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="grid gap-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-neutral-200">
            <Feature
              icon={<IconReceipt size={20} />}
              title={`От ${MIN_PRICE} ₽`}
              text="за сессию, подбор бесплатный"
            />
            <Feature
              icon={<IconDeviceLaptop size={20} />}
              title="Удобный формат"
              text="Онлайн, без поездок, в удобное время"
            />
            <Feature
              icon={<IconLock size={20} />}
              title="Конфиденциально"
              text="Анкету видят только оператор и ваш психолог"
            />
          </div>
        </section>

        {/* Запросы */}
        <section className="bg-neutral-50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl font-bold sm:text-4xl">
              С какими запросами мы работаем
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REQUESTS.map((r) => (
                <div
                  key={r.title}
                  className={`rounded-2xl border border-neutral-100 bg-white p-6 ${r.wide ? "lg:col-span-2" : ""}`}
                >
                  <h3 className="text-lg font-semibold">{r.title}</h3>
                  <p className="mt-2 text-neutral-600">{r.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
              Сервис не предназначен для состояний, угрожающих жизни и здоровью,
              и не заменяет медицинскую помощь. Срочная помощь — 112,
              психологическая помощь МЧС{" "}
              <a
                href="tel:+74959895050"
                className="whitespace-nowrap text-brand-700 underline"
              >
                +7 (495) 989-50-50
              </a>{" "}
              (круглосуточно, бесплатно).{" "}
              <Link href="/crisis" className="text-brand-700 underline">
                Все телефоны помощи
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Не знаете, с чего начать?
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Расскажите нам немного о своем запросе, а мы найдем для вас
            подходящего специалиста
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 h-12 rounded-xl bg-brand-600 px-7 text-base text-white hover:bg-brand-700"
          >
            <Link href={startHref}>Подобрать психолога</Link>
          </Button>
        </section>

        <SelectionSection />
        <HowSection startHref={startHref} />
        <PricesSection startHref={startHref} />

        {/* Психологи */}
        {showcase.length > 0 && (
          <PsyShowcase items={showcase} startHref={startHref} />
        )}

        {/* Отзывы — только настоящие, опубликованные после модерации */}
        {latestReviews.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Отзывы наших клиентов
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latestReviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-neutral-100 p-5"
                >
                  <div className="text-brand-600">{"★".repeat(r.rating)}</div>
                  {r.body && <p className="mt-2 text-neutral-700">{r.body}</p>}
                  <div className="mt-4 text-sm text-neutral-500">
                    {r.authorName} · о работе с {r.psyName}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-4 py-16">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ответы на частые вопросы
          </h2>
          <FaqList items={CLIENT_FAQ.slice(0, 5)} className="mt-8" />
          <Button asChild variant="outline" className="mt-6 rounded-xl">
            <Link href="/faq">Смотреть все вопросы →</Link>
          </Button>
        </section>

        {/* Финальный CTA */}
        <section className="bg-brand-50">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Не нужно разбираться в анкетах в одиночку
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600">
              Расскажите нам немного о своем запросе, а мы найдем для вас
              подходящего специалиста
            </p>
            <Button
              asChild
              size="lg"
              className="mt-6 h-12 rounded-xl bg-brand-600 px-7 text-base text-white hover:bg-brand-700"
            >
              <Link href={cabinet === "/me" ? "/me" : startHref}>
                {cabinet === "/me"
                  ? "Перейти в кабинет"
                  : "Подобрать психолога"}
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:px-5 sm:first:pl-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
        {icon}
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-neutral-500">{text}</div>
      </div>
    </div>
  );
}
