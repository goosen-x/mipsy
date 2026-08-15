import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site";

export const metadata = { title: "Психологам — mipsy" };

const TERMS = [
  {
    title: "Клиенты приходят к вам",
    text: "Мы собираем заявки, оператор вручную подбирает клиентов под ваши темы и опыт. Вы не тратите время на продвижение.",
  },
  {
    title: "Связь — через платформу",
    text: "Мы бережём и клиентов, и специалистов: контакты закрыты, координацию берёт на себя оператор. Увод клиентов с платформы запрещён этическим кодексом.",
  },
  {
    title: "Честная модерация",
    text: "Мы смотрим образование, опыт, супервизию и личную терапию. Это защищает и клиентов, и репутацию проверенных специалистов.",
  },
];

export default function PsyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl font-bold">Работайте с клиентами mipsy</h1>
        <p className="mt-4 text-lg text-neutral-600">
          mipsy — сервис ручного подбора психологов. Заполните заявку — мы изучим её и свяжемся с
          вами. После одобрения вы получите профиль на платформе и доступ в кабинет.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {TERMS.map((t) => (
            <div key={t.title} className="rounded-2xl bg-brand-50 p-5">
              <div className="font-semibold text-brand-800">{t.title}</div>
              <p className="mt-2 text-sm text-neutral-600">{t.text}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-12 text-2xl font-bold">Кого мы берём</h2>
        <ul className="mt-4 space-y-2 text-neutral-700">
          <li>· Высшее психологическое образование или профессиональная переподготовка</li>
          <li>
            · Законченное обучение основному подходу: от 200 часов для КПТ, схема-терапии, ACT и
            подобных, от 500 часов для гештальта, психоанализа, юнгианского анализа
          </li>
          <li>· Опыт консультирования от 2 лет</li>
          <li>· Опыт личной терапии</li>
          <li>· Регулярная супервизия</li>
          <li>· Самозанятость или ИП — для выплат</li>
          <li>
            · Согласие с этическим кодексом: научно обоснованные методы, конфиденциальность, работа
            с клиентами платформы только через платформу
          </li>
        </ul>
        <p className="mt-4 text-sm text-neutral-500">
          Проверяем документы и проводим интервью на 30 минут. Стоимость сессий вы назначаете
          сами и указываете в профиле — клиент видит её до записи.
        </p>

        <h2 className="mt-12 text-2xl font-bold">Заявка на модерацию</h2>
        <p className="mt-2 text-neutral-500">
          Несколько коротких шагов: о себе, образование и сканы документов. Понадобится войти по
          коду с почты — по ней же вы будете входить в кабинет.
        </p>
        <div className="mt-6">
          <Link
            href="/psy/anketa"
            className="inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Подать заявку
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
