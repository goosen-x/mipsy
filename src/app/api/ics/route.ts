import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { clientRequests, db, psychologists, slots } from "@/db";
import { buildIcs } from "@/lib/ics";

const SITE_URL = process.env.SITE_URL ?? "https://mipsy.mskacademy.ru";

/** Файл приглашения для «Добавить в календарь» на странице клиента. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const slotId = Number(url.searchParams.get("slot"));
  if (!token || !slotId) return new NextResponse("Bad request", { status: 400 });

  const [row] = await db
    .select({
      startsAt: slots.startsAt,
      durationMin: slots.durationMin,
      psyName: psychologists.name,
    })
    .from(slots)
    .innerJoin(clientRequests, eq(slots.clientRequestId, clientRequests.id))
    .innerJoin(psychologists, eq(slots.psychologistId, psychologists.id))
    .where(and(eq(slots.id, slotId), eq(clientRequests.clientToken, token)));
  if (!row) return new NextResponse("Not found", { status: 404 });

  const ics = buildIcs({
    uid: `mipsy-slot-${slotId}@mipsy.mskacademy.ru`,
    startsAt: row.startsAt,
    durationMin: row.durationMin,
    summary: `Встреча с психологом ${row.psyName} (mipsy)`,
    description: `Ваша страница на mipsy: ${SITE_URL}/me/${token}`,
    url: `${SITE_URL}/me/${token}`,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vstrecha-mipsy.ics"',
    },
  });
}
