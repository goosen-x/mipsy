"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Заголовок слева от стрелок. */
  header?: ReactNode;
  /** Ширина слайда: tailwind-классы basis для разных брейкпоинтов. */
  slideClassName: string;
  gapClassName?: string;
  label?: string;
};

// Копий набора в ленте: средняя — рабочая, крайние — запас под бесконечную прокрутку.
const COPIES = 3;
// Меньше трёх слайдов зацикливать незачем: на десктопе видно два сразу.
const MIN_LOOP = 3;

/**
 * Бесконечная карусель на нативном scroll-snap. Слайды повторены трижды;
 * пользователь листает среднюю копию, а когда прокрутка останавливается в
 * крайней — позиция без анимации переносится на тот же слайд в средней.
 * Свайп и тачпад работают сами, стрелки листают на один слайд.
 */
export function Carousel({
  children,
  header,
  slideClassName,
  gapClassName = "gap-4",
  label = "Карусель",
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);
  const n = slides.length;
  const loop = n >= MIN_LOOP;
  const [index, setIndex] = useState(0);
  // Текущий слайд для ResizeObserver: после ресайза scrollLeft уже не делится на новый шаг.
  const indexRef = useRef(0);
  const [edges, setEdges] = useState({ prev: false, next: n > 1 });

  const step = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return 1;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.offsetWidth + gap;
  }, []);

  /** Перенос в среднюю копию без анимации — визуально ничего не меняется. */
  const recenter = useCallback(() => {
    const track = trackRef.current;
    if (!track || !loop) return;
    const s = step();
    const pos = Math.round(track.scrollLeft / s);
    const i = ((pos % n) + n) % n;
    if (pos !== n + i) {
      track.scrollTo({ left: (n + i) * s, behavior: "instant" });
    }
  }, [loop, n, step]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
      const s = step();
      const pos = Math.round(track.scrollLeft / s);
      indexRef.current = ((pos % n) + n) % n;
      setIndex(indexRef.current);
      if (!loop) {
        const max = track.scrollWidth - track.clientWidth;
        setEdges({
          prev: track.scrollLeft > 2,
          next: track.scrollLeft < max - 2,
        });
      }
      // scrollend есть не везде (Safari) — ждём паузу в прокрутке сами.
      clearTimeout(settle);
      settle = setTimeout(recenter, 150);
    };

    if (loop) {
      track.scrollTo({ left: n * step(), behavior: "instant" });
    }
    onScroll();
    track.addEventListener("scroll", onScroll, { passive: true });
    // При смене ширины слайды меняют размер — держим текущий слайд на месте.
    const ro = new ResizeObserver(() => {
      if (loop)
        track.scrollTo({
          left: (n + indexRef.current) * step(),
          behavior: "instant",
        });
    });
    ro.observe(track);
    return () => {
      clearTimeout(settle);
      track.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [loop, n, recenter, step]);

  const go = (dir: -1 | 1) =>
    trackRef.current?.scrollBy({ left: dir * step(), behavior: "smooth" });
  const goTo = (i: number) =>
    trackRef.current?.scrollTo({
      left: ((loop ? n : 0) + i) * step(),
      behavior: "smooth",
    });

  const canPrev = loop || edges.prev;
  const canNext = loop || edges.next;

  const arrowBtn =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-brand-200 bg-white text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-white";
  const arrowsRow = (className?: string) =>
    n > 1 && (
      <div className={cn("flex gap-2", className)}>
        <button
          type="button"
          aria-label="Назад"
          className={arrowBtn}
          disabled={!canPrev}
          onClick={() => go(-1)}
        >
          <IconArrowLeft size={20} />
        </button>
        <button
          type="button"
          aria-label="Вперёд"
          className={arrowBtn}
          disabled={!canNext}
          onClick={() => go(1)}
        >
          <IconArrowRight size={20} />
        </button>
      </div>
    );

  const copies = loop ? COPIES : 1;
  const middle = loop ? 1 : 0;

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">{header}</div>
        {arrowsRow("hidden sm:flex")}
      </div>

      <div
        ref={trackRef}
        tabIndex={0}
        className={cn(
          "-mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 outline-none",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          gapClassName,
        )}
      >
        {Array.from({ length: copies }, (_, c) =>
          slides.map((slide, i) => (
            <div
              key={`${c}-${i}`}
              // Копии — только для прокрутки: скрыты от скринридеров и табуляции.
              aria-hidden={c !== middle || undefined}
              inert={c !== middle || undefined}
              className={cn("shrink-0 snap-start", slideClassName)}
            >
              {slide}
            </div>
          )),
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-6">
        {n > 1 && (
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Слайд ${i + 1}`}
                aria-current={i === index || undefined}
                onClick={() => goTo(i)}
                className={cn(
                  "h-2 cursor-pointer rounded-full transition-all",
                  i === index ? "w-6 bg-brand-600" : "w-2 bg-brand-200",
                )}
              />
            ))}
          </div>
        )}
        {arrowsRow("sm:hidden")}
      </div>
    </div>
  );
}
