import Link from "next/link";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconCheck,
  IconClipboardList,
  IconHeartHandshake,
  IconLifebuoy,
  IconLock,
  IconMessageCircle,
  IconSearch,
  IconSparkles,
  IconUserCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/**
 * Пустой кабинет клиента (вошёл, анкету ещё не заполнял) — пять вариантов
 * на выбор. Переключатель видят админы и локальная разработка; клиенты —
 * вариант по умолчанию. После выбора лишние варианты удалить.
 */
export const EMPTY_VARIANTS = [
  { n: 1, label: "Две дороги" },
  { n: 2, label: "С картинкой" },
  { n: 3, label: "Путь из шагов" },
  { n: 4, label: "Дашборд" },
  { n: 5, label: "С чего начнём?" },
] as const;

export const DEFAULT_EMPTY_VARIANT = 3;

export function EmptyCabinet({ variant, name }: { variant: number; name: string }) {
  switch (variant) {
    case 1:
      return <V1 name={name} />;
    case 2:
      return <V2 name={name} />;
    case 4:
      return <V4 name={name} />;
    case 5:
      return <V5 name={name} />;
    default:
      return <V3 name={name} />;
  }
}

/* 1. Две большие карточки-выбора + полоска «как это работает» */
function V1({ name }: { name: string }) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Здравствуйте, {name}!</h1>
      <p className="mt-2 text-lg text-neutral-600">Кабинет готов. Выберите, как найти психолога.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/anketa"
          className="group flex flex-col rounded-3xl bg-brand-600 p-7 text-white transition-colors hover:bg-brand-700"
        >
          <IconSparkles size={32} />
          <div className="mt-6 text-2xl font-semibold">Подобрать психолога</div>
          <p className="mt-2 text-white">Ответьте на вопросы. Мы предложим подходящих специалистов.</p>
          <div className="mt-auto flex items-center justify-between pt-8 text-sm text-white/80">
            <span>≈ 5 минут · бесплатно</span>
            <IconArrowRight className="transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
        <Link
          href="/psihologi"
          className="group flex flex-col rounded-3xl border border-neutral-200 p-7 transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <IconSearch size={32} className="text-brand-600" />
          <div className="mt-6 text-2xl font-semibold">Выбрать самому</div>
          <p className="mt-2 text-neutral-600">Откройте каталог. Смотрите профили, цены и свободное время.</p>
          <div className="mt-auto flex items-center justify-between pt-8 text-sm text-neutral-500">
            <span>Все проверенные специалисты</span>
            <IconArrowRight className="text-brand-600 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>
      <div className="mt-8 grid gap-4 rounded-2xl bg-neutral-50 p-5 text-sm sm:grid-cols-3">
        {[
          ["1", "Анкета", "Расскажите о запросе"],
          ["2", "Подбор", "Выберите психолога"],
          ["3", "Сессия", "Запишитесь на удобное время"],
        ].map(([n, t, d]) => (
          <div key={n} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-brand-700 shadow-sm">
              {n}
            </div>
            <div>
              <div className="font-semibold">{t}</div>
              <div className="text-neutral-500">{d}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

/* 2. Приветствие слева, картинка справа — продолжение страницы входа */
function V2({ name }: { name: string }) {
  return (
    <main className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-[1fr_0.9fr]">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">
          <IconCheck size={16} /> Кабинет создан
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-tight">
          Здравствуйте, {name}!
          <br />
          <span className="text-brand-600">Начнём подбор?</span>
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          Ответьте на несколько вопросов. Мы предложим специалистов под ваш запрос.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/anketa">Подобрать психолога</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/psihologi">Открыть каталог</Link>
          </Button>
        </div>
        <ul className="mt-8 space-y-2 text-neutral-600">
          {["Подбор бесплатный", "Анкету видят только оператор и ваш психолог", "Не подошёл — подберём другого"].map(
            (t) => (
              <li key={t} className="flex items-center gap-2">
                <IconCheck size={18} className="text-brand-600" /> {t}
              </li>
            ),
          )}
        </ul>
      </div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/cabinet-online.jpg" alt="" className="h-full w-full object-cover" />
      </div>
    </main>
  );
}

/* 3. Вертикальный путь: шаг 1 активен, 2 и 3 ждут */
function V3({ name }: { name: string }) {
  const steps = [
    {
      icon: IconClipboardList,
      title: "Заполните анкету",
      text: "Расскажите, что происходит и что важно в психологе. Около 5 минут.",
      active: true,
    },
    {
      icon: IconHeartHandshake,
      title: "Выберите психолога",
      text: "Мы предложим до трёх специалистов. Откройте профили и выберите одного.",
    },
    {
      icon: IconCalendarEvent,
      title: "Запишитесь на сессию",
      text: "Выберите свободное время. Ссылка на встречу придёт на почту.",
    },
  ];
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Здравствуйте, {name}!</h1>
      <p className="mt-2 text-lg text-neutral-600">Три шага до первой сессии.</p>
      <ol className="mt-8">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-5 pb-8 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute left-6 top-12 h-[calc(100%-3rem)] w-px bg-neutral-200" />
            )}
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${s.active ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-400"}`}
            >
              <s.icon size={24} />
            </div>
            <div className={`flex-1 rounded-2xl p-5 ${s.active ? "border border-brand-200 bg-brand-50" : ""}`}>
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">Шаг {i + 1}</div>
              <div className={`mt-1 text-lg font-semibold ${s.active ? "" : "text-neutral-500"}`}>{s.title}</div>
              <p className={`mt-1 ${s.active ? "text-neutral-700" : "text-neutral-400"}`}>{s.text}</p>
              {s.active && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button asChild>
                    <Link href="/anketa">Начать анкету</Link>
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

/* 4. Будущий кабинет с пустыми блоками — видно, что здесь появится */
function V4({ name }: { name: string }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Здравствуйте, {name}!</h1>
          <p className="mt-2 text-neutral-600">Здесь будут ваш психолог, встречи и оплата.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/anketa">Подобрать психолога</Link>
        </Button>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-brand-600 p-6 text-white lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <IconUserCircle size={18} /> Мой психолог
          </div>
          <div className="mt-4 text-2xl font-semibold">Пока не выбран</div>
          <p className="mt-2 max-w-md text-white">
            Заполните анкету — мы предложим до трёх специалистов. Или выберите сами в каталоге.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-brand-700 hover:bg-brand-50">
              <Link href="/anketa">Начать анкету</Link>
            </Button>
            <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link href="/psihologi">Каталог →</Link>
            </Button>
          </div>
        </div>
        <EmptyCard icon={IconCalendarEvent} title="Встречи" text="Записей пока нет" />
        <EmptyCard icon={IconMessageCircle} title="Поддержка" text="Есть вопрос — напишите нам" link="/support" />
        <EmptyCard icon={IconLock} title="Конфиденциально" text="Анкету видят только оператор и ваш психолог" />
        <EmptyCard icon={IconLifebuoy} title="Срочная помощь" text="Телефоны круглосуточных линий" link="/crisis" />
      </div>
    </main>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  text,
  link,
}: {
  icon: typeof IconCalendarEvent;
  title: string;
  text: string;
  link?: string;
}) {
  const body = (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon size={22} />
      </div>
      <div className="mt-4 font-semibold">{title}</div>
      <div className="mt-1 text-sm text-neutral-500">{text}</div>
    </>
  );
  return link ? (
    <Link href={link} className="rounded-3xl border border-neutral-200 p-6 transition-colors hover:border-brand-300">
      {body}
    </Link>
  ) : (
    <div className="rounded-3xl border border-dashed border-neutral-200 p-6">{body}</div>
  );
}

/* 5. По центру вопрос и три варианта ответа, включая срочную помощь */
function V5({ name }: { name: string }) {
  const options = [
    {
      href: "/anketa",
      icon: IconSparkles,
      title: "Помогите подобрать",
      text: "Короткая анкета, мы предложим специалистов",
      primary: true,
    },
    { href: "/psihologi", icon: IconSearch, title: "Выберу сам", text: "Каталог с фильтрами по темам и цене" },
    { href: "/crisis", icon: IconLifebuoy, title: "Нужна помощь сейчас", text: "Круглосуточные телефоны поддержки" },
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <IconHeartHandshake size={32} />
      </div>
      <h1 className="mt-6 text-4xl font-bold">С чего начнём, {name}?</h1>
      <p className="mt-3 text-lg text-neutral-600">Выберите вариант. Подбор бесплатный.</p>
      <div className="mt-10 grid gap-3 text-left">
        {options.map((o) => (
          <Link
            key={o.title}
            href={o.href}
            className={`group flex items-center gap-4 rounded-2xl p-5 transition-colors ${o.primary ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-neutral-100 hover:bg-brand-50"}`}
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${o.primary ? "bg-white/15" : "bg-white text-brand-600"}`}
            >
              <o.icon size={24} />
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold">{o.title}</div>
              <div className={o.primary ? "text-white" : "text-neutral-500"}>{o.text}</div>
            </div>
            <IconArrowRight className="transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </main>
  );
}
