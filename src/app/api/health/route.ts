import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Проверка живости для внешнего мониторинга: приложение отвечает и база читается. */
export async function GET() {
  try {
    const rows = db.all<{ n: number }>(sql`SELECT count(*) AS n FROM topics`);
    return NextResponse.json({ ok: true, topics: rows?.[0]?.n ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "db error" },
      { status: 503 },
    );
  }
}
