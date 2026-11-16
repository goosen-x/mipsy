import { NextResponse } from "next/server";
import { currentAccountId } from "@/lib/auth";

/**
 * Подсказки для формы образования — прокси к открытому API hh.ru:
 *   ?kind=institutions&text=мгу   — вузы и колледжи
 *   ?kind=faculties&id=39144      — факультеты выбранного вуза
 *   ?kind=fields&text=психол      — специальности
 * Через сервер, а не из браузера: у hh нет CORS для чужих доменов, а ответы
 * справочника можно кэшировать на сутки. Только для вошедших — не открытый прокси.
 */
const HH = "https://api.hh.ru";
const DAY = 60 * 60 * 24;

export type EduSuggestion = { id: string | null; title: string; hint?: string };

export async function GET(req: Request) {
  if (!(await currentAccountId())) return NextResponse.json({ items: [] }, { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, 100);
  const id = url.searchParams.get("id") ?? "";

  let upstream: string;
  if (kind === "institutions" && text.length >= 2) {
    upstream = `${HH}/suggests/educational_institutions?text=${encodeURIComponent(text)}`;
  } else if (kind === "fields" && text.length >= 2) {
    upstream = `${HH}/suggests/fields_of_study?text=${encodeURIComponent(text)}`;
  } else if (kind === "faculties" && /^\d{1,12}$/.test(id)) {
    upstream = `${HH}/educational_institutions/${id}/faculties`;
  } else {
    return NextResponse.json({ items: [] });
  }

  try {
    const res = await fetch(upstream, {
      // hh требует осмысленный User-Agent от приложений.
      headers: { "User-Agent": "mipsy/1.0 (psyo.ru)" },
      next: { revalidate: DAY },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ items: [] });
    const data = await res.json();

    let items: EduSuggestion[];
    if (kind === "faculties") {
      items = (Array.isArray(data) ? data : []).map((f: { id: string; name: string }) => ({
        id: String(f.id),
        title: f.name,
      }));
    } else if (kind === "institutions") {
      items = (data.items ?? []).map(
        (i: { id: string; acronym?: string; text: string; synonyms?: string | null }) => ({
          id: String(i.id),
          title: i.acronym || i.text,
          hint: [i.synonyms, i.acronym ? i.text : null].filter(Boolean).join(", "),
        }),
      );
    } else {
      items = (data.items ?? []).map((i: { id: string; text: string }) => ({ id: String(i.id), title: i.text }));
    }
    return NextResponse.json({ items: items.slice(0, 30) });
  } catch {
    // Справочник недоступен — форма работает и без подсказок.
    return NextResponse.json({ items: [] });
  }
}
