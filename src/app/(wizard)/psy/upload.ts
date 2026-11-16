"use server";

import { randomUUID } from "node:crypto";
import { currentAccount } from "@/lib/auth";
import { putObject } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Заявленному Content-Type не доверяем — проверяем сигнатуру самих байтов. */
function looksLikeDocument(bytes: Buffer): boolean {
  const isPdf = bytes.subarray(0, 4).toString() === "%PDF";
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp =
    bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  return isPdf || isJpg || isPng || isWebp;
}

/** Скан диплома или сертификата к заявке психолога. Требует входа. */
export async function uploadEducationDoc(
  formData: FormData,
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: "Войдите на сайт заново" };

  const file = formData.get("doc");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Файл больше 10 МБ" };

  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: "Подойдёт PDF, JPG, PNG или WebP" };

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeDocument(bytes)) return { ok: false, error: "Файл не похож на документ" };

  const { url } = await putObject(`${randomUUID()}.${ext}`, bytes);
  return { ok: true, url, name: file.name };
}
