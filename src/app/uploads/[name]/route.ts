import { NextResponse } from "next/server";
import { getObject } from "@/lib/storage";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Отдаёт загруженные фото из хранилища: в образ они не попадают. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const file = await getObject(name);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": MIME[name.split(".").pop() as string],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
