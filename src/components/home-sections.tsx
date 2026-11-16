import Link from "next/link";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { GRADES } from "@/lib/grades";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Блоки главной, которые живут и на отдельных страницах: /about, /how, /prices.
 * Один источник — чтобы тексты на главной и в разделах не разъезжались.
 */

const SELECTION = [
  {
    title: "Диплом и образование",
    text: "Проверяем документ о профильном психологическом образовании.",
  },
  {
    title: "Опыт и супервизии",
    text: "Подтверждаем стаж, практику и участие в супервизиях.",
  },
  {
    title: "Собеседование",
    text: "Специалист проходит интервью с экспертным советом МИП.",
  },
  {
    title: "Допуск и уровень",
    text: "Присваиваем уровень — базовый, опытный или ведущий. От него зависит цена сессии.",
  },
];

// Описания уровней — к грейдам из lib/grades.ts; цены берутся оттуда же.
const GRADE_INFO: Record<number, { description: string; features: string[] }> =
  {
    1: {
      description: "Психолог в начале практики",
      features: [
        "Диплом и допуск подтверждены",
        "Ведёт приём под супервизией опытного коллеги",
        "Подходит, чтобы начать терапию",
      ],
    },
    2: {
      description: "Уверенная регулярная практика",
      features: [
        "Опыт консультирования от 3 лет",
        "Регулярная практика",
        "Проходит супервизии",
      ],
    },
    3: {
      description: "Эксперт с узкой специализацией",
      features: [
        "Опыт консультирования от 5 лет",
        "Узкая специализация",
        "Супервизорская или экспертная практика",
      ],
    },
  };

// Средний уровень выделяем, как «популярный» тариф.
const HIGHLIGHTED_GRADE = 2;

export function SelectionSection({ asPage = false }: { asPage?: boolean }) {
  return (
    <section id="about" className={cn("mx-auto max-w-6xl scroll-mt-6 px-4 pb-16", asPage && "pt-12")}>
      <SectionTitle asPage={asPage}>
        Как мы отбираем наших специалистов
      </SectionTitle>
      <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1fr_0.95fr]">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {SELECTION.map((s) => (
            <div key={s.title} className="rounded-2xl bg-brand-50 p-6">
              <h3 className="text-lg font-semibold text-brand-700">
                {s.title}
              </h3>
              <p className="mt-2 text-neutral-600">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="relative min-h-80 overflow-hidden rounded-2xl bg-brand-600">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/selection.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-16 text-white">
            <div className="text-lg font-semibold">
              Проект Московского института психологии
            </div>
            <div className="mt-1 text-sm text-white/80">
              Специалистов отбирает экспертный совет МИП
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowSection({ startHref, asPage = false }: { startHref: string; asPage?: boolean }) {
  return (
    <section id="how" className={cn("mx-auto max-w-6xl scroll-mt-6 px-4 pb-16", asPage && "pt-12")}>
      <SectionTitle asPage={asPage}>
        Как начать терапию с психологом mipsy
      </SectionTitle>
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-brand-600 p-7 text-white">
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10"
            />
            <div className="text-sm text-white/70">01</div>
            <h3 className="mt-2 text-2xl font-semibold">Заполните анкету</h3>
            <p className="mt-2 max-w-md text-white">
              Расскажите, с чем хотите поработать и что для вас важно в
              психологе. Это займёт около 5 минут.
            </p>
            <Button
              asChild
              className="mt-6 h-11 rounded-xl bg-white px-6 text-brand-700 hover:bg-brand-50"
            >
              <Link href={startHref}>Заполнить анкету</Link>
            </Button>
          </div>
          <div className="flex items-center gap-6 rounded-2xl border border-neutral-100 bg-neutral-50 p-7">
            <div className="flex-1">
              <div className="text-sm text-neutral-400">02</div>
              <h3 className="mt-2 text-xl font-semibold">
                Алгоритм подберёт подходящих специалистов
              </h3>
              <p className="mt-2 text-neutral-600">
                Изучите профили и выберите психолога, с которым хотите начать
                терапию.
              </p>
            </div>
            <RadarIcon />
          </div>
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50">
          <div className="p-7">
            <div className="text-sm text-neutral-400">03</div>
            <h3 className="mt-2 text-2xl font-semibold">
              Выберите дату и время первой сессии
            </h3>
            <p className="mt-2 text-neutral-600">
              Свободные окна видны в календаре психолога. Ссылка на встречу
              придёт на почту.
            </p>
          </div>
          <CalendarMock />
        </div>
      </div>
    </section>
  );
}

export function PricesSection({ startHref, asPage = false }: { startHref: string; asPage?: boolean }) {
  return (
    <section id="prices" className="scroll-mt-6 bg-brand-50/60">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle asPage={asPage}>
          Сколько стоит консультация
        </SectionTitle>
        <p className="mt-4 max-w-2xl text-lg text-neutral-600">
          Цена зависит только от уровня психолога. Сессия идёт 50 минут онлайн,
          подбор бесплатный.
        </p>
        <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-3">
          {Object.entries(GRADES).map(([grade, g]) => {
            const info = GRADE_INFO[Number(grade)];
            const highlighted = Number(grade) === HIGHLIGHTED_GRADE;
            return (
              <div
                key={grade}
                className={cn(
                  "relative flex flex-col rounded-2xl bg-white p-6 lg:p-8",
                  highlighted
                    ? "border-2 border-brand-600 shadow-lg shadow-brand-600/10"
                    : "border border-brand-100",
                )}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                    Оптимальный выбор
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold">{g.title}</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {info.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {g.price.toLocaleString("ru-RU")}
                    </span>
                    <span className="text-neutral-500">₽</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    за сессию 50 минут
                  </p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {info.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <IconCheck size={14} stroke={2.5} />
                      </span>
                      <span className="text-sm text-neutral-700">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  variant={highlighted ? "default" : "outline"}
                  className={cn(
                    "h-12 w-full cursor-pointer rounded-xl text-base",
                    highlighted
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800",
                  )}
                >
                  <Link href={startHref}>Подобрать психолога</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Шаг 2: «паутинка» совпадения по критериям. */
function RadarIcon() {
  return (
    <div className="hidden h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-white sm:flex">
      <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e5" />
        <circle cx="50" cy="50" r="26" fill="none" stroke="#e5e5e5" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="#e5e5e5" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="#e5e5e5" />
        <polygon
          points="50,18 80,48 58,82 26,58"
          fill="#855edf"
          fillOpacity="0.15"
          stroke="#855edf"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[
          [50, 18],
          [80, 48],
          [58, 82],
          [26, 58],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#855edf" />
        ))}
      </svg>
    </div>
  );
}

/** Шаг 3: макет календаря записи. */
function CalendarMock() {
  const times = ["10:00", "12:30", "15:00", "19:00"];
  return (
    <div className="mt-auto bg-brand-50 p-7 pt-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Ноябрь</span>
          <IconArrowRight size={16} className="text-neutral-400" />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
          {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
            <div key={d} className="uppercase text-brand-600">
              {d}
            </div>
          ))}
          {Array.from({ length: 14 }, (_, i) => i + 10).map((d) => (
            <div
              key={d}
              className={`rounded-full py-1.5 ${d === 13 ? "bg-brand-600 font-medium text-white" : [11, 14, 17, 20].includes(d) ? "font-medium text-neutral-800" : "text-neutral-300"}`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {times.map((t) => (
            <span
              key={t}
              className={`rounded-lg px-3 py-1.5 text-sm ${t === "19:00" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-800"}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** На главной блок — раздел (h2), на своей странице — заголовок страницы (h1). */
function SectionTitle({ asPage, children }: { asPage: boolean; children: React.ReactNode }) {
  return asPage ? (
    <h1 className="text-4xl font-bold sm:text-5xl">{children}</h1>
  ) : (
    <h2 className="text-3xl font-bold sm:text-4xl">{children}</h2>
  );
}
