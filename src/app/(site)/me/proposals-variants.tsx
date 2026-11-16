"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCalendarEvent, IconCheck } from "@tabler/icons-react";
import { PsyAvatar } from "@/components/psy-showcase/avatar";
import { cn } from "@/lib/utils";
import { ChoosePsychologist } from "./controls";

import type { Proposal } from "./proposals-config";

type Props = { proposals: Proposal[]; anyChosen: boolean };

export function ProposalsView({ variant, ...props }: Props & { variant: number }) {
  switch (variant) {
    case 2:
      return <Cards {...props} />;
    case 3:
      return <Compare {...props} />;
    case 4:
      return <Tabs {...props} />;
    case 5:
      return <Photos {...props} />;
    default:
      return <List {...props} />;
  }
}

/* ---------- общие кусочки ---------- */

const reason = (note: string | null) =>
  note && note !== "выбрал сам в каталоге" && note !== "автоподбор по анкете" ? note : null;

function Meta({ p }: { p: Proposal["psy"] }) {
  return (
    <>
      {[p.approach, p.experienceYears != null ? `опыт ${p.experienceYears} лет` : null]
        .filter(Boolean)
        .join(" · ")}
    </>
  );
}

function Topics({ topics, max = 4, className }: { topics: string[]; max?: number; className?: string }) {
  if (!topics.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {topics.slice(0, max).map((t) => (
        <span key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800">
          {t}
        </span>
      ))}
    </div>
  );
}

function Slot({ slot, className }: { slot: string | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm", className)}>
      <IconCalendarEvent size={16} className="shrink-0 text-brand-600" />
      {slot ? <span>Ближайшее окно: {slot}</span> : <span className="text-neutral-500">Окна уточняются</span>}
    </div>
  );
}

function Actions({ item, anyChosen, stretch }: { item: Proposal; anyChosen: boolean; stretch?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", stretch && "flex-col items-stretch [&>div]:w-full [&_button]:w-full")}>
      {item.chosen ? (
        <Link
          href="/me/vstrechi#booking"
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-800 hover:bg-brand-100"
        >
          <IconCheck size={16} /> Выбран · записаться
        </Link>
      ) : (
        <ChoosePsychologist psychologistId={item.psy.id} label={anyChosen ? "Выбрать вместо" : undefined} />
      )}
      {item.psy.slug && (
        <Link
          href={`/psihologi/${item.psy.slug}`}
          className={cn("text-sm text-brand-700 underline", stretch && "text-center")}
        >
          Открыть профиль
        </Link>
      )}
    </div>
  );
}

/* ---------- 1. Список ---------- */

function List({ proposals, anyChosen }: Props) {
  return (
    <div className="mt-6 divide-y divide-neutral-100">
      {proposals.map((item) => (
        <div key={item.matchId} className="flex flex-wrap items-start gap-5 py-6 first:pt-0">
          <PsyAvatar name={item.psy.name} photoUrl={item.psy.photoUrl} className="h-24 w-24 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-lg font-semibold">{item.psy.name}</div>
              {item.psy.price && <div className="font-semibold">{item.psy.price}</div>}
            </div>
            <div className="text-sm text-neutral-500">
              <Meta p={item.psy} />
            </div>
            <Topics topics={item.psy.topics} className="mt-2" />
            <Slot slot={item.psy.nearestSlot} className="mt-3" />
            {reason(item.note) && <p className="mt-2 text-sm text-neutral-600">Почему подошёл: {reason(item.note)}</p>}
            <div className="mt-4">
              <Actions item={item} anyChosen={anyChosen} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 2. Карточки в ряд ---------- */

function Cards({ proposals, anyChosen }: Props) {
  return (
    <div className="mt-6 grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
      {proposals.map((item) => (
        <div
          key={item.matchId}
          className={cn(
            "flex flex-col rounded-3xl border p-5",
            item.chosen ? "border-brand-600 bg-brand-50/40" : "border-neutral-200",
          )}
        >
          <PsyAvatar name={item.psy.name} photoUrl={item.psy.photoUrl} className="h-52 w-full @xl:h-auto @xl:aspect-square rounded-2xl" />
          <div className="mt-4 text-lg font-semibold">{item.psy.name}</div>
          <div className="text-sm text-neutral-500">
            <Meta p={item.psy} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm">
            <span className="text-neutral-500">{item.psy.gradeTitle ?? "Сессия"}</span>
            <span className="font-semibold">{item.psy.price ?? "уточняется"}</span>
          </div>
          <Topics topics={item.psy.topics} max={3} className="mt-3" />
          <Slot slot={item.psy.nearestSlot} className="mt-3" />
          <div className="mt-auto pt-5">
            <Actions item={item} anyChosen={anyChosen} stretch />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 3. Таблица сравнения ---------- */

function Compare({ proposals, anyChosen }: Props) {
  const rows: { label: string; value: (p: Proposal) => React.ReactNode }[] = [
    { label: "Стоимость", value: (p) => <span className="font-semibold">{p.psy.price ?? "уточняется"}</span> },
    { label: "Уровень", value: (p) => p.psy.gradeTitle ?? "—" },
    { label: "Опыт", value: (p) => (p.psy.experienceYears != null ? `${p.psy.experienceYears} лет` : "—") },
    { label: "Подход", value: (p) => p.psy.approach ?? "—" },
    { label: "Ближайшее окно", value: (p) => p.psy.nearestSlot ?? "уточняется" },
    { label: "Темы", value: (p) => <Topics topics={p.psy.topics} max={4} /> },
  ];
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="w-36" />
            {proposals.map((p) => (
              <th
                key={p.matchId}
                className={cn("rounded-t-2xl p-4 text-left align-top font-normal", p.chosen && "bg-brand-50")}
              >
                <PsyAvatar name={p.psy.name} photoUrl={p.psy.photoUrl} className="h-16 w-16 rounded-2xl" />
                <div className="mt-3 text-base font-semibold">{p.psy.name}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="border-t border-neutral-100 py-3 pr-4 align-top text-neutral-500">{r.label}</td>
              {proposals.map((p) => (
                <td
                  key={p.matchId}
                  className={cn("border-t border-neutral-100 p-4 align-top", p.chosen && "bg-brand-50")}
                >
                  {r.value(p)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {proposals.map((p) => (
              <td key={p.matchId} className={cn("rounded-b-2xl p-4", p.chosen && "bg-brand-50")}>
                <Actions item={p} anyChosen={anyChosen} stretch />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 4. Вкладки ---------- */

function Tabs({ proposals, anyChosen }: Props) {
  const [active, setActive] = useState(() => Math.max(0, proposals.findIndex((p) => p.chosen)));
  const item = proposals[active];
  return (
    <div className="mt-6">
      <div role="tablist" className="flex flex-wrap gap-2">
        {proposals.map((p, i) => (
          <button
            key={p.matchId}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-2 pr-4 text-left transition-colors",
              i === active ? "border-brand-600 bg-brand-50" : "border-neutral-200 hover:border-brand-300",
            )}
          >
            <PsyAvatar name={p.psy.name} photoUrl={p.psy.photoUrl} className="h-12 w-12 rounded-xl text-base" />
            <div>
              <div className="font-medium">{p.psy.name.split(" ")[0]}</div>
              <div className="text-xs text-neutral-500">{p.psy.price ?? "—"}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-6 rounded-3xl border border-neutral-200 p-6 @xl:grid-cols-[220px_1fr]">
        <PsyAvatar name={item.psy.name} photoUrl={item.psy.photoUrl} className="h-52 w-full @xl:h-auto @xl:aspect-[4/5] rounded-2xl" />
        <div>
          <div className="text-2xl font-semibold">{item.psy.name}</div>
          <div className="mt-1 text-neutral-500">
            <Meta p={item.psy} />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-neutral-500">Сессия: </span>
              <span className="font-semibold">{item.psy.price ?? "уточняется"}</span>
            </div>
            <Slot slot={item.psy.nearestSlot} />
          </div>
          {item.psy.about && <p className="mt-4 line-clamp-4 text-neutral-700">{item.psy.about}</p>}
          <Topics topics={item.psy.topics} max={6} className="mt-4" />
          <div className="mt-6">
            <Actions item={item} anyChosen={anyChosen} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 5. Крупные фото ---------- */

function Photos({ proposals, anyChosen }: Props) {
  return (
    <div className="mt-6 grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
      {proposals.map((item) => (
        <div key={item.matchId} className="flex flex-col">
          <div className="relative h-64 @xl:h-auto @xl:aspect-[3/4] overflow-hidden rounded-3xl bg-brand-100">
            <PsyAvatar
              name={item.psy.name}
              photoUrl={item.psy.photoUrl}
              className="absolute inset-0 h-full w-full text-6xl"
            />
            {item.chosen && (
              <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-800">
                Вы выбрали
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-5 pt-20 text-white">
              <div className="text-xl font-semibold">{item.psy.name}</div>
              <div className="text-sm text-white/85">
                <Meta p={item.psy} />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>{item.psy.nearestSlot ? `Окно: ${item.psy.nearestSlot}` : "Окна уточняются"}</span>
                <span className="font-semibold">{item.psy.price}</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Actions item={item} anyChosen={anyChosen} stretch />
          </div>
        </div>
      ))}
    </div>
  );
}
