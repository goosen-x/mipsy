import Link from "next/link";
import { FaqList } from "@/components/faq-list";
import { PSY_FAQ } from "@/content/faq";

export const metadata = { title: "Психологам — mipsy" };

const TERMS = [
  {
    title: "Клиенты приходят к вам",
    text: "Мы собираем заявки и подбираем клиентов под ваши темы и опыт. Вы не тратите время на продвижение.",
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
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl font-bold">Работайте с клиентами mipsy</h1>
        <p className="mt-4 text-lg text-neutral-600">
          mipsy — сервис подбора психологов. Заполните заявку — мы изучим её и свяжемся с вами.
          После одобрения вы получите профиль на платформе и доступ в кабинет.
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
          <li>· Большой опыт не обязателен: начинающие работают под обязательной супервизией</li>
          <li>· Личная терапия: от 10 часов для начинающих, 30–50 часов — для старших уровней</li>
          <li>· Регулярная супервизия</li>
          <li>· Самозанятость или ИП — для выплат</li>
          <li>
            · Согласие с{" "}
            <Link href="/ethics" className="text-brand-700 underline">
              соглашением о профессиональных стандартах и этике
            </Link>
          </li>
        </ul>
        <p className="mt-4 text-sm text-neutral-500">
          Проверяем документы и проводим интервью. По итогам присваиваем уровень допуска — от него
          зависит стоимость сессии, клиент видит её до записи.
        </p>

        <h2 className="mt-12 text-2xl font-bold">Заявка на модерацию</h2>
        <p className="mt-2 text-neutral-500">
          Несколько коротких шагов о себе — и кабинет готов. Образование и сканы документов
          приложите в кабинете. Понадобится войти по коду с почты — по ней же вы будете входить в
          кабинет.
        </p>
        <div className="mt-6">
          <Link
            href="/psy/anketa"
            className="inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Подать заявку
          </Link>
        </div>

        <h2 className="mt-12 text-2xl font-bold">Частые вопросы</h2>
        <FaqList items={PSY_FAQ} className="mt-4" />
      </main>
    </>
  );
}
