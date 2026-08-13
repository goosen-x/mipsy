import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, psychologists, slots } from "@/db";
import { accountRequestIds, currentAccountId } from "@/lib/auth";
import { buildIcs } from "@/lib/ics";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

/** Файл приглашения для «Добавить в календарь» в кабинете клиента. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slotId = Number(url.searchParams.get("slot"));
  if (!slotId) return new NextResponse("Bad request", { status: 400 });

  const accountId = await currentAccountId();
  if (!accountId) return new NextResponse("Unauthorized", { status: 401 });

  const requestIds = await accountRequestIds(accountId);
  if (requestIds.length === 0) return new NextResponse("Not found", { status: 404 });

  const [row] = await db
    .select({
      startsAt: slots.startsAt,
      durationMin: slots.durationMin,
      meetingLink: slots.meetingLink,
      psyName: psychologists.name,
    })
    .from(slots)
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .where(and(eq(slots.id, slotId), inArray(slots.clientRequestId, requestIds)));
  if (!row) return new NextResponse("Not found", { status: 404 });

  const ics = buildIcs({
    uid: `mipsy-slot-${slotId}@mipsy.mskacademy.ru`,
    startsAt: row.startsAt,
    durationMin: row.durationMin,
    summary: `Встреча с психологом ${row.psyName} (mipsy)`,
    description: row.meetingLink
      ? `Ссылка на встречу: ${row.meetingLink}\nВаш кабинет на mipsy: ${SITE_URL}/me`
      : `Ваш кабинет на mipsy: ${SITE_URL}/me`,
    url: row.meetingLink ?? `${SITE_URL}/me`,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vstrecha-mipsy.ics"',
    },
  });
}
