import Link from "next/link";
import { IconCircleCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { FaqList } from "@/components/faq-list";
import { PSY_FAQ } from "@/content/faq";

export const metadata = { title: "Психологам — mipsy" };

// Все кнопки страницы ведут в одно место — заявку специалиста. Остальное
// (опрос, документы, описание, слоты) психолог заполняет уже в кабинете.
const APPLY_HREF = "/psy/anketa";

const REQUIREMENTS = [
  {
    title: "Профильная подготовка",
    text: "Высшее психологическое образование или высшее образование другого профиля с профессиональной переподготовкой по психологии",
  },
  {
    title: "Опыт консультирования",
    text: "Рассматриваем начинающих психологов, в том числе работающих под супервизией, и опытных специалистов",
  },
  {
    title: "Подтверждение квалификации",
    text: "Проверяем документы об образовании. При необходимости пригласим на короткое интервью",
  },
  {
    title: "Профессиональное развитие",
    text: "Ценим специалистов, которые проходят личную терапию, обращаются за супервизией и продолжают обучение",
  },
  {
    title: "Готовность консультировать онлайн",
    text: "Проводите дистанционные консультации и общаетесь с клиентами через личный кабинет платформы",
  },
  {
    title: "Соблюдение профессиональной этики",
    text: "Уважаете границы клиента, соблюдаете конфиденциальность и правила работы платформы",
  },
];

const STEPS = [
  {
    title: "Подайте заявку",
    text: "Заполните анкету, загрузите документы об образовании и опыте",
  },
  {
    title: "Пройдите проверку",
    text: "Мы проверим документы и при необходимости пригласим вас на короткое интервью",
  },
  {
    title: "Проведите первую сессию",
    text: "Настройте профиль и начинайте практику",
  },
];

export default function PsyPage() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-300 px-3 py-1.5 text-sm text-neutral-700">
            <IconCircleCheck size={18} className="text-brand-600" />
            Для начинающих и опытных специалистов
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Помогаем психологам находить клиентов
          </h1>
          <p className="mt-6 max-w-xl text-lg text-neutral-600">
            Размещайте анкету в нашем каталоге и получайте обращения от людей, которые ищут
            психологическую помощь
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 cursor-pointer rounded-xl bg-brand-600 px-7 text-base text-white hover:bg-brand-700"
          >
            <Link href={APPLY_HREF}>Подать заявку</Link>
          </Button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/cabinet-online.jpg"
          alt="Онлайн-консультация с психологом"
          className="aspect-[4/3] w-full rounded-2xl object-cover"
        />
      </section>

      {/* Требования */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold sm:text-4xl">Кто может присоединиться к платформе</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REQUIREMENTS.map((r) => (
              <div key={r.title} className="rounded-2xl border border-neutral-100 bg-white p-6">
                <h3 className="text-lg font-semibold">{r.title}</h3>
                <p className="mt-2 text-neutral-600">{r.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Подробнее о правилах — в{" "}
            <Link href="/ethics" className="cursor-pointer text-brand-700 underline">
              соглашении о профессиональных стандартах и этике
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">Присоединяйтесь к платформе</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-600">
          Полные условия, тарифы и правила выплат — в личном кабинете сразу после регистрации
        </p>
        <Button
          asChild
          size="lg"
          className="mt-6 h-12 cursor-pointer rounded-xl bg-brand-600 px-7 text-base text-white hover:bg-brand-700"
        >
          <Link href={APPLY_HREF}>Зарегистрироваться</Link>
        </Button>
      </section>

      {/* Как начать */}
      <section id="start" className="scroll-mt-6 bg-brand-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold sm:text-4xl">Как начать сотрудничество</h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-brand-100 bg-white p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-neutral-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Вопросы */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-4 py-16">
        <h2 className="text-3xl font-bold sm:text-4xl">Частые вопросы</h2>
        <FaqList items={PSY_FAQ} className="mt-8" />
      </section>
    </main>
  );
}
