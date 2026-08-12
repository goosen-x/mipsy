import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { uploadsDir } from "@/lib/uploads";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Отдаёт загруженные фото из volume: в образ они не попадают. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // Имя генерируем сами (uuid.ext) — всё остальное отбрасываем, чтобы исключить обход каталога.
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const file = await readFile(path.join(uploadsDir(), name));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": MIME[name.split(".").pop() as string],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
