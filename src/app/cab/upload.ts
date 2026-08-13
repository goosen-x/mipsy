"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, psychologists } from "@/db";
import { currentAccountId } from "@/lib/auth";
import { putObject } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Заявленному Content-Type не доверяем — проверяем сигнатуру самих байтов. */
function looksLikeImage(bytes: Buffer): boolean {
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp =
    bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  return isJpg || isPng || isWebp;
}

export async function uploadPhoto(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const accountId = await currentAccountId();
  const [psy] = accountId
    ? await db
        .select({ id: psychologists.id, slug: psychologists.slug })
        .from(psychologists)
        .where(eq(psychologists.accountId, accountId))
    : [];
  if (!psy) return { ok: false, error: "Войдите в кабинет заново" };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Файл больше 5 МБ" };

  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: "Подойдёт JPG, PNG или WebP" };

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(bytes)) return { ok: false, error: "Файл не похож на изображение" };

  const { url } = await putObject(`${randomUUID()}.${ext}`, bytes);
  await db.update(psychologists).set({ photoUrl: url }).where(eq(psychologists.id, psy.id));

  revalidatePath("/cab");
  if (psy.slug) revalidatePath(`/p/${psy.slug}`);
  return { ok: true, url };
}
