import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, psychologists, topics } from "@/db";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const revalidate = 60;

const PAINS = [
  "Тревога не отпускает, даже когда всё «нормально»",
  "Работа выжала — сил нет ни на что",
  "Отношения буксуют, разговоры превращаются в ссоры",
  "Потеряли близкого человека и не знаете, как жить дальше",
  "Просто плохо, и непонятно почему",
];

const STEPS = [
  {
    title: "Расскажите о себе",
    text: "Анкета на 5 минут: что происходит, что для вас важно в специалисте, когда удобно встречаться.",
  },
  {
    title: "Мы подберём психолога",
    text: "Не алгоритм, а живой человек изучит вашу анкету, подберёт специалиста под запрос и напишет вам.",
  },
  {
    title: "Выберите время",
    text: "Первая встреча с психологом бесплатная — чтобы понять, ваш ли это человек. Выбираете свободное время в календаре и приходите.",
  },
];

const FAQ = [
  {
    q: "Как вы подбираете психолога?",
    a: "Вручную. Оператор читает вашу анкету целиком — запрос, пожелания, удобное время — и подбирает специалиста, который работает именно с такими темами. Вам не нужно разбираться в подходах и листать каталог.",
  },
  {
    q: "А если психолог не подойдёт?",
    a: "Скажете нам — и мы бесплатно подберём другого. Это нормальная часть процесса: с первого раза совпадает не всегда, и это не значит, что терапия «не работает».",
  },
  {
    q: "Сколько это стоит?",
    a: "Подбор бесплатный, и первая встреча с психологом тоже — платить нужно только за последующие сессии. Их стоимость каждый специалист указывает в своём профиле, вы видите её заранее.",
  },
  {
    q: "Вы проверяете психологов?",
    a: "Да. Каждый специалист проходит проверку перед тем, как попасть на платформу: мы смотрим образование, опыт и то, как он работает. В профиле — только проверенные факты.",
  },
  {
    q: "Это конфиденциально?",
    a: "Да. Вашу анкету видят только оператор и психолог, с которым вас соединили. Общение идёт через платформу: письма приходят на почту, телефон нужен только для срочной связи по вашей заявке.",
  },
];

export default async function Home() {
  const topicList = await db.select().from(topics).orderBy(asc(topics.sort));
  const approved = await db
    .select()
    .from(psychologists)
    .where(eq(psychologists.moderationStatus, "approved"))
    .limit(3);

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="bg-brand-50">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
              Мы подберём вам психолога
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-700">
              Не знаете, с чего начать? Создайте личный кабинет, ответьте на несколько вопросов о
              себе — и мы вручную подберём специалиста под ваш запрос. Не подойдёт — бесплатно
              подберём другого.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 rounded-lg bg-accent-500 px-8 py-6 text-lg hover:bg-accent-600"
            >
              <Link href="/login">Создать личный кабинет</Link>
            </Button>
            <p className="mt-3 text-sm text-neutral-500">
              ≈ 5 минут · первая встреча с психологом бесплатна
            </p>
            <p className="mt-4 text-sm text-neutral-600">
              или{" "}
              <Link href="/catalog" className="font-medium text-brand-700 underline">
                посмотреть психологов самостоятельно
              </Link>
            </p>
          </div>
        </section>

        {/* Боли */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-3xl font-bold">Знакомо?</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PAINS.map((p) => (
              <li key={p} className="rounded-2xl border border-neutral-200 p-5 text-neutral-700">
                {p}
              </li>
            ))}
            <li className="rounded-2xl bg-brand-600 p-5 font-medium text-white">
              С этим можно работать — и не в одиночку. Первый шаг занимает пять минут.
            </li>
          </ul>
        </section>

        {/* Как это работает */}
        <section className="bg-neutral-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-3xl font-bold">Как это работает</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <Card key={s.title} className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                      {i + 1}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 text-neutral-600">{s.text}</p>
                  </CardContent>
                </Card>
              ))}
            </ol>
          </div>
        </section>

        {/* Проверка психологов — мягкая формулировка, критерии модерации ещё не зафиксированы */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <div className="rounded-3xl bg-brand-600 p-10 text-white">
            <h2 className="text-3xl font-bold">Кто наши психологи</h2>
            <p className="mt-4 max-w-3xl text-lg text-brand-100">
              Каждый специалист проходит проверку перед тем, как попасть на платформу: мы смотрим
              образование, опыт и то, как он работает с клиентами. Общение идёт через mipsy — вы
              всегда можете обратиться к нам, если что-то пошло не так.
            </p>
          </div>
        </section>

        {/* Примеры профилей — появляются, когда есть одобренные специалисты */}
        {approved.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 pb-16">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-3xl font-bold">Наши специалисты</h2>
              <Link href="/catalog" className="font-medium text-brand-700 underline">
                Все психологи →
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {approved.map((p) => (
                <Link key={p.id} href={`/p/${p.slug}`}>
                  <Card className="h-full transition-colors hover:border-brand-400">
                    <CardContent className="p-6">
                      <div className="text-lg font-semibold">{p.name}</div>
                      <div className="mt-1 text-sm text-neutral-500">{p.approach}</div>
                      <div className="mt-2 text-sm text-neutral-600">
                        Опыт: {p.experienceYears} лет
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Темы */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-3xl font-bold">С чем к нам приходят</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {topicList.map((t) => (
              <Badge
                key={t.slug}
                variant="secondary"
                className="rounded-full px-4 py-2 text-sm font-normal"
              >
                {t.title}
              </Badge>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-neutral-50">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="text-3xl font-bold">Вопросы и ответы</h2>
            <Accordion type="single" collapsible className="mt-8">
              {FAQ.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="text-left text-lg font-semibold">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-neutral-600">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Финальный CTA */}
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold">Пять минут — и подбор начнётся</h2>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-lg bg-accent-500 px-8 py-6 text-lg hover:bg-accent-600"
          >
            <Link href="/login">Создать личный кабинет</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
