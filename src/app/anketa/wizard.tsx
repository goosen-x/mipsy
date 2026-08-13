"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { submitAnketa, type AnketaPayload } from "./actions";

type Topic = { slug: string; title: string };

type State = {
  gender: string | null;
  age: string;
  therapyExperience: string | null;
  mainProblem: string | null;
  topicSlugs: string[];
  topicOther: string;
  freqDown: string | null;
  freqSleep: string | null;
  freqSelfHarm: string | null;
  lifeImpact: string | null;
  prefGender: string | null;
  prefAge: string | null;
  preferredTime: string[];
  story: string;
  name: string;
  email: string;
  pdConsent: boolean;
};

const FREQ_OPTIONS = [
  ["never", "Никогда"],
  ["seldom", "Редко"],
  ["monthly", "Несколько раз в месяц"],
  ["weekly", "Несколько раз в неделю"],
  ["daily", "Каждый день"],
] as const;

const PROBLEMS = [
  ["anxiety", "Тревога, страхи"],
  ["depression", "Подавленность, депрессия"],
  ["self-esteem", "Самооценка"],
  ["relationships", "Отношения"],
  ["burnout", "Выгорание"],
  ["loss", "Утрата"],
  ["childhood", "Детский опыт, травма"],
  ["other", "Другое / сложно сказать"],
] as const;

const TIME_OPTIONS = [
  ["morning", "Утро (до 12:00)"],
  ["day", "День (12:00–17:00)"],
  ["evening", "Вечер (после 17:00)"],
  ["weekend", "Выходные"],
] as const;

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function AnketaWizard({ topics, knownEmail = "" }: { topics: Topic[]; knownEmail?: string }) {
  const [state, setState] = useState<State>({
    gender: null,
    age: "",
    therapyExperience: null,
    mainProblem: null,
    topicSlugs: [],
    topicOther: "",
    freqDown: null,
    freqSleep: null,
    freqSelfHarm: null,
    lifeImpact: null,
    prefGender: null,
    prefAge: null,
    preferredTime: [],
    story: "",
    name: "",
    email: knownEmail,
    pdConsent: true,
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  // Кризисный экран вставляется в маршрут сразу после вопроса о самоповреждении,
  // если ответ — не «никогда».
  const steps = useMemo(() => {
    const s = [
      "gender",
      "age",
      "therapy",
      "problem",
      "topics",
      "freqDown",
      "freqSleep",
      "freqSelfHarm",
    ];
    if (state.freqSelfHarm && state.freqSelfHarm !== "never") s.push("crisis");
    s.push("lifeImpact", "prefs", "time", "story", "contact");
    return s;
  }, [state.freqSelfHarm]);

  const step = steps[stepIdx];
  const progress = Math.round((stepIdx / steps.length) * 100);

  function set<K extends keyof State>(key: K, value: State[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }

  function back() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  // Одиночный выбор: сохранить и продвинуться с маленькой паузой для отклика.
  function pick<K extends keyof State>(key: K, value: State[K]) {
    set(key, value);
    setTimeout(next, 180);
  }

  function submit() {
    setError(null);
    const payload: AnketaPayload = {
      forWhom: "self",
      gender: state.gender,
      age: state.age ? Number(state.age) : null,
      therapyExperience: state.therapyExperience,
      mainProblem: state.mainProblem,
      topicSlugs: state.topicSlugs,
      topicOther: state.topicOther || null,
      freqDown: state.freqDown,
      freqSleep: state.freqSleep,
      freqSelfHarm: state.freqSelfHarm,
      lifeImpact: state.lifeImpact,
      prefGender: state.prefGender,
      prefAge: state.prefAge,
      preferredTime: state.preferredTime,
      story: state.story || null,
      name: state.name,
      email: state.email || null,
      pdConsent: state.pdConsent,
    };
    startTransition(async () => {
      const res = await submitAnketa(payload);
      if (res.ok) setDone(true);
      else setError(res.error ?? "Что-то пошло не так, попробуйте ещё раз");
    });
  }

  if (done) {
    return (
      <Shell progress={100} onBack={null}>
        <h1 className="text-3xl font-bold">Спасибо, {state.name}!</h1>
        <p className="mt-4 text-lg text-neutral-600">
          Анкета у нас. Оператор изучит её и напишет вам на{" "}
          <span className="font-medium text-neutral-900">{state.email}</span>, чтобы обсудить
          подбор психолога. Обычно это занимает не больше одного рабочего дня.
        </p>
        <div className="mt-6 rounded-2xl bg-brand-50 p-5">
          <div className="font-semibold text-brand-800">Личный кабинет уже открыт</div>
          <p className="mt-1 text-sm text-neutral-600">
            Здесь будет виден подобранный психолог и свободное время для записи. На этом устройстве
            вы уже вошли; с другого — впустим по адресу{" "}
            <span className="font-medium text-neutral-900">{state.email}</span> и коду из письма.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/me">Перейти в кабинет</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">На главную</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell progress={progress} onBack={stepIdx > 0 ? back : null}>
      {step === "gender" && (
        <Question title="Ваш пол?">
          {[
            ["female", "Женщина"],
            ["male", "Мужчина"],
            ["skip", "Не хочу отвечать"],
          ].map(([v, label]) => (
            <OptionButton key={v} onClick={() => pick("gender", v)} active={state.gender === v}>
              {label}
            </OptionButton>
          ))}
        </Question>
      )}

      {step === "age" && (
        <Question title="Сколько вам лет?">
          <Input
            type="number"
            inputMode="numeric"
            min={16}
            max={100}
            placeholder="Например, 29"
            value={state.age}
            onChange={(e) => set("age", e.target.value)}
            className="h-14 text-lg"
          />
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={!state.age || Number(state.age) < 16 || Number(state.age) > 100}
            onClick={next}
          >
            Продолжить
          </Button>
          <Hint>Мы работаем с клиентами от 16 лет.</Hint>
        </Question>
      )}

      {step === "therapy" && (
        <Question title="Был ли у вас опыт терапии раньше?">
          {[
            ["none", "Нет, это впервые"],
            ["short", "Была, короткая"],
            ["long", "Была, длительная"],
          ].map(([v, label]) => (
            <OptionButton
              key={v}
              onClick={() => pick("therapyExperience", v)}
              active={state.therapyExperience === v}
            >
              {label}
            </OptionButton>
          ))}
          <Hint>
            Если вы впервые — это хорошо, что вы здесь. Психолог поможет разобраться, чего ожидать
            от работы.
          </Hint>
        </Question>
      )}

      {step === "problem" && (
        <Question title="Что беспокоит больше всего?">
          {PROBLEMS.map(([v, label]) => (
            <OptionButton
              key={v}
              onClick={() => pick("mainProblem", v)}
              active={state.mainProblem === v}
            >
              {label}
            </OptionButton>
          ))}
          <Hint>Это предварительный вопрос — дальше будет возможность рассказать подробнее.</Hint>
        </Question>
      )}

      {step === "topics" && (
        <Question title="Какие темы вам близки?" subtitle="Можно выбрать несколько">
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const activeTopic = state.topicSlugs.includes(t.slug);
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() =>
                    set(
                      "topicSlugs",
                      activeTopic
                        ? state.topicSlugs.filter((s) => s !== t.slug)
                        : [...state.topicSlugs, t.slug],
                    )
                  }
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    activeTopic
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-neutral-300 hover:border-brand-400",
                  )}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
          <Input
            placeholder="Другое — напишите своими словами"
            value={state.topicOther}
            onChange={(e) => set("topicOther", e.target.value)}
            className="mt-4"
          />
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={state.topicSlugs.length === 0 && !state.topicOther.trim()}
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "freqDown" && (
        <FreqQuestion
          title="Как часто вы чувствуете подавленность?"
          value={state.freqDown}
          onPick={(v) => pick("freqDown", v)}
        />
      )}

      {step === "freqSleep" && (
        <FreqQuestion
          title="Как часто бывают проблемы со сном?"
          value={state.freqSleep}
          onPick={(v) => pick("freqSleep", v)}
        />
      )}

      {step === "freqSelfHarm" && (
        <FreqQuestion
          title="Бывают ли мысли причинить себе вред?"
          value={state.freqSelfHarm}
          onPick={(v) => pick("freqSelfHarm", v)}
          hint="Этот вопрос мы задаём каждому. Ответ поможет подобрать специалиста с нужным опытом — и его увидят только оператор и ваш психолог."
        />
      )}

      {step === "crisis" && (
        <div>
          <h1 className="text-2xl font-bold">Спасибо, что поделились. Это важно.</h1>
          <p className="mt-3 text-neutral-600">
            Подбор психолога занимает время, а поддержка иногда нужна сразу. Если станет совсем
            тяжело — вот бесплатные круглосуточные линии, где отвечают живые люди:
          </p>
          <ul className="mt-5 space-y-3">
            <li className="rounded-xl border p-4">
              <div className="font-semibold">8 (800) 2000-122</div>
              <div className="text-sm text-neutral-600">
                Телефон доверия для детей, подростков и родителей
              </div>
            </li>
            <li className="rounded-xl border p-4">
              <div className="font-semibold">+7 (495) 989-50-50</div>
              <div className="text-sm text-neutral-600">Линия психологической помощи МЧС</div>
            </li>
            <li className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="font-semibold">112</div>
              <div className="text-sm text-neutral-600">Если есть угроза жизни — прямо сейчас</div>
            </li>
          </ul>
          <p className="mt-4 text-sm text-neutral-500">
            Анкету можно продолжить — мы отнесёмся к вашей заявке с особым вниманием.
          </p>
          <Button className="mt-5 w-full" size="lg" onClick={next}>
            Продолжить анкету
          </Button>
        </div>
      )}

      {step === "lifeImpact" && (
        <Question title="Насколько это состояние мешает повседневной жизни?">
          {[
            ["none", "Почти не мешает"],
            ["some", "Немного мешает"],
            ["strong", "Сильно мешает"],
            ["unbearable", "Невыносимо мешает"],
          ].map(([v, label]) => (
            <OptionButton
              key={v}
              onClick={() => pick("lifeImpact", v)}
              active={state.lifeImpact === v}
            >
              {label}
            </OptionButton>
          ))}
        </Question>
      )}

      {step === "prefs" && (
        <Question title="Есть ли пожелания к специалисту?">
          <div className="text-sm font-medium text-neutral-500">Пол психолога</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["woman", "Женщина"],
              ["man", "Мужчина"],
              ["any", "Не важно"],
            ].map(([v, label]) => (
              <SmallOption
                key={v}
                onClick={() => set("prefGender", v)}
                active={state.prefGender === v}
              >
                {label}
              </SmallOption>
            ))}
          </div>
          <div className="mt-5 text-sm font-medium text-neutral-500">Возраст психолога</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["under40", "До 40 лет"],
              ["over40", "От 40 лет"],
              ["any", "Не важно"],
            ].map(([v, label]) => (
              <SmallOption key={v} onClick={() => set("prefAge", v)} active={state.prefAge === v}>
                {label}
              </SmallOption>
            ))}
          </div>
          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={!state.prefGender || !state.prefAge}
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "time" && (
        <Question title="Когда вам удобно встречаться?" subtitle="Можно выбрать несколько">
          {TIME_OPTIONS.map(([v, label]) => {
            const activeTime = state.preferredTime.includes(v);
            return (
              <OptionButton
                key={v}
                active={activeTime}
                onClick={() =>
                  set(
                    "preferredTime",
                    activeTime
                      ? state.preferredTime.filter((s) => s !== v)
                      : [...state.preferredTime, v],
                  )
                }
              >
                {label}
              </OptionButton>
            );
          })}
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={state.preferredTime.length === 0}
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "story" && (
        <Question
          title="Расскажите, что происходит"
          subtitle="Своими словами — это самое ценное для подбора. Что беспокоит, как давно, чего хочется от работы с психологом."
        >
          <Textarea
            rows={7}
            value={state.story}
            onChange={(e) => set("story", e.target.value)}
            placeholder="Например: последние полгода не могу уснуть без тревожных мыслей о работе…"
            className="text-base"
          />
          <WordMeter words={countWords(state.story)} />
          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={countWords(state.story) === 0}
            onClick={next}
          >
            Продолжить
          </Button>
        </Question>
      )}

      {step === "contact" && (
        <Question
          title="Как с вами связаться?"
          subtitle="Оператор mipsy напишет вам, чтобы обсудить подбор. Никакой рассылки и спама."
        >
          <Label htmlFor="name">Ваше имя</Label>
          <Input
            id="name"
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Как к вам обращаться"
            className="mt-1"
          />
          {knownEmail ? (
            <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm">
              <span className="text-neutral-600">Почта подтверждена: </span>
              <span className="font-medium text-brand-800">{knownEmail}</span>
              <div className="mt-0.5 text-xs text-neutral-500">
                На неё придут подбор и подтверждение записи.
              </div>
            </div>
          ) : (
            <>
              <Label htmlFor="email" className="mt-4 block">
                Email — вход в личный кабинет и письма о встречах
              </Label>
              <Input
                id="email"
                type="email"
                value={state.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="ivan@example.com"
                className="mt-1"
              />
            </>
          )}
          <div className="mt-4 flex items-start gap-3">
            <Checkbox
              id="pd"
              checked={state.pdConsent}
              onCheckedChange={(c) => set("pdConsent", c === true)}
            />
            <Label htmlFor="pd" className="text-sm font-normal leading-snug text-neutral-600">
              Соглашаюсь на обработку персональных данных. Анкету увидят только оператор и
              подобранный психолог.
            </Label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={pending || !state.name.trim() || !state.email.trim() || !state.pdConsent}
            onClick={submit}
          >
            {pending ? "Отправляем…" : "Отправить анкету"}
          </Button>
        </Question>
      )}
    </Shell>
  );
}

function Shell({
  children,
  progress,
  onBack,
}: {
  children: React.ReactNode;
  progress: number;
  onBack: (() => void) | null;
}) {
  return (
    <div className="min-h-screen bg-brand-50/50">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
        <button
          type="button"
          onClick={onBack ?? undefined}
          className={cn(
            "text-sm text-neutral-500 hover:text-brand-700",
            !onBack && "invisible",
          )}
        >
          ← Назад
        </button>
        <Link href="/" className="text-xl font-bold text-brand-700">
          mipsy
        </Link>
      </header>
      <div className="mx-auto max-w-xl px-4">
        <Progress value={progress} className="h-1.5" />
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">{children}</div>
        <p className="py-6 text-center text-xs text-neutral-400">
          Если помощь нужна срочно —{" "}
          <Link href="/crisis" className="underline">
            телефоны экстренной поддержки
          </Link>
        </p>
      </div>
    </div>
  );
}

function Question({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-2 text-neutral-500">{subtitle}</p>}
      <div className="mt-6 space-y-2">{children}</div>
    </div>
  );
}

function OptionButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-base transition-colors",
        active
          ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
          : "border-neutral-200 hover:border-brand-400",
        disabled && "cursor-not-allowed opacity-50 hover:border-neutral-200",
      )}
    >
      {children}
    </button>
  );
}

function SmallOption({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm transition-colors",
        active
          ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
          : "border-neutral-200 hover:border-brand-400",
      )}
    >
      {children}
    </button>
  );
}

function FreqQuestion({
  title,
  value,
  onPick,
  hint,
}: {
  title: string;
  value: string | null;
  onPick: (v: string) => void;
  hint?: string;
}) {
  return (
    <Question title={title}>
      {FREQ_OPTIONS.map(([v, label]) => (
        <OptionButton key={v} onClick={() => onPick(v)} active={value === v}>
          {label}
        </OptionButton>
      ))}
      {hint && <Hint>{hint}</Hint>}
    </Question>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">{children}</div>
  );
}

function WordMeter({ words }: { words: number }) {
  const percent = Math.min(100, (words / 30) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{words} слов</span>
        <span>{words < 30 ? "чем подробнее, тем точнее подбор" : "отлично!"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

