import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Хранилище файлов пользователей (фото психологов и документы об образовании).
 *
 * Реализация локальная: файлы лежат в volume рядом с базой и отдаются
 * роутом `/uploads/[name]`. Всё, что знает остальной код, — это ключ файла
 * и публичный адрес, который возвращает `publicUrl`.
 *
 * Переезд на S3: заменить тело трёх функций ниже на вызовы SDK и вернуть из
 * `publicUrl` адрес бакета или CDN. Роут `/uploads/[name]` тогда можно удалить,
 * а существующие записи перевести запросом:
 *   UPDATE psychologists SET photo_url = 'https://<бакет>/' || substr(photo_url, 10)
 *   WHERE photo_url LIKE '/uploads/%';
 * Ключи файлов при этом не меняются, поэтому переносится только содержимое.
 */

export type StoredObject = { key: string; url: string };

function localDir(): string {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
  return path.join(path.dirname(dbPath), "uploads");
}

/** Ключи генерируем сами (uuid.ext) — снаружи произвольные имена не принимаются. */
export function isValidKey(key: string): boolean {
  return /^[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/.test(key);
}

export function publicUrl(key: string): string {
  return `/uploads/${key}`;
}

export async function putObject(key: string, bytes: Buffer): Promise<StoredObject> {
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), bytes);
  return { key, url: publicUrl(key) };
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (!isValidKey(key)) return null;
  try {
    return await readFile(path.join(localDir(), key));
  } catch {
    return null;
  }
}
