import { and, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { clientRequests, db, psychologists, slots } from "@/db";
import { mskPlusHours } from "@/lib/datetime";
import { buildFeed } from "@/lib/ics";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

/**
 * ICS-фид «мои встречи mipsy» для психолога: подписка по секретной ссылке из
 * Google/Яндекс/Apple-календаря. Отданы брони и состоявшиеся встречи за
 * последний месяц; отменённое исчезает из фида — календарь подписчика сам
 * убирает событие при следующем опросе.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) return new NextResponse("Not found", { status: 404 });

  const [psy] = await db
    .select({ id: psychologists.id })
    .from(psychologists)
    .where(eq(psychologists.calendarToken, token));
  if (!psy) return new NextResponse("Not found", { status: 404 });

  const monthAgo = mskPlusHours(-30 * 24);
  const rows = await db
    .select({
      id: slots.id,
      startsAt: slots.startsAt,
      durationMin: slots.durationMin,
      status: slots.status,
      isIntroCall: slots.isIntroCall,
      meetingLink: slots.meetingLink,
      clientName: clientRequests.name,
    })
    .from(slots)
    .leftJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .where(
      and(
        eq(slots.psychologistId, psy.id),
        inArray(slots.status, ["booked", "done"]),
        gte(slots.startsAt, monthAgo),
      ),
    )
    .orderBy(slots.startsAt);

  const feed = buildFeed({
    name: "mipsy — встречи",
    events: rows.map((s) => ({
      uid: `mipsy-slot-${s.id}@mipsy.mskacademy.ru`,
      startsAt: s.startsAt,
      durationMin: s.durationMin,
      summary: `Сессия: ${s.clientName ?? "клиент"}${s.isIntroCall ? " · первая встреча" : ""} (mipsy)`,
      description: s.meetingLink
        ? `Ссылка на встречу: ${s.meetingLink}\nКабинет: ${SITE_URL}/cab`
        : `Кабинет: ${SITE_URL}/cab`,
      url: s.meetingLink ?? `${SITE_URL}/cab`,
    })),
  });

  return new NextResponse(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Календари опрашивают фид сами (Google — раз в несколько часов);
      // короткий кэш защищает лишь от частых ручных обновлений.
      "Cache-Control": "private, max-age=300",
    },
  });
}
