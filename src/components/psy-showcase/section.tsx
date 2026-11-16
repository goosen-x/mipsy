import Link from "next/link";
import { IconCalendarEvent } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PsyAvatar } from "./avatar";
import { Carousel } from "./carousel";
import { experienceLabel, type ShowcasePsy } from "./data";

type Props = { items: ShowcasePsy[]; startHref: string };

function Avatar({ p, className }: { p: ShowcasePsy; className?: string }) {
  return (
    <PsyAvatar name={p.name} photoUrl={p.photoUrl} className={className} />
  );
}

function GradeChip({
  grade,
  className,
}: {
  grade: string | null;
  className?: string;
}) {
  if (!grade) return null;
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800",
        className,
      )}
    >
      {grade}
    </span>
  );
}

function Heading({
  children = "Психологи mipsy",
}: {
  children?: React.ReactNode;
}) {
  return <h2 className="text-3xl font-bold sm:text-4xl">{children}</h2>;
}

function CatalogLink({
  startHref,
  className,
}: {
  startHref: string;
  className?: string;
}) {
  return (
    <div className={cn("mt-10 text-center", className)}>
      <Button
        asChild
        size="lg"
        className="h-12 cursor-pointer rounded-xl bg-brand-600 px-7 text-base text-white hover:bg-brand-700"
      >
        <Link href={startHref}>Подобрать психолога</Link>
      </Button>
    </div>
  );
}

/** Секция «Психологи» на главной: широкие карточки в карусели. */
export function PsyShowcase({ items, startHref }: Props) {
  return (
    <section className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Carousel
          label="Психологи mipsy"
          header={<Heading>Познакомьтесь с психологами</Heading>}
          slideClassName="basis-[90%] lg:basis-[calc((100%-1.5rem)/2)]"
          gapClassName="gap-6"
        >
          {items.map((p) => (
            <div
              key={p.id}
              className="flex h-full flex-col gap-5 rounded-3xl bg-white p-5 sm:flex-row"
            >
              <Avatar
                p={p}
                className="aspect-square w-full shrink-0 rounded-2xl sm:aspect-auto sm:h-auto sm:w-44"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <GradeChip grade={p.grade} />
                  {experienceLabel(p.experienceYears) && (
                    <span className="text-xs text-neutral-500">
                      {experienceLabel(p.experienceYears)}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xl font-semibold">{p.name}</div>
                <div className="text-sm text-neutral-500">{p.approach}</div>
                {p.about && (
                  <p className="mt-3 line-clamp-3 flex-1 text-sm text-neutral-600">
                    {p.about}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5 text-neutral-600">
                    <IconCalendarEvent size={16} className="text-brand-600" />
                    {p.nearestSlot ?? "Окно уточняется"}
                  </span>
                  <span className="font-semibold">{p.price}</span>
                </div>
                <Button
                  asChild
                  className="mt-4 cursor-pointer self-start rounded-xl bg-brand-600 px-5 text-white hover:bg-brand-700"
                >
                  <Link href={p.href}>Открыть профиль</Link>
                </Button>
              </div>
            </div>
          ))}
        </Carousel>
        <CatalogLink startHref={startHref} />
      </div>
    </section>
  );
}
