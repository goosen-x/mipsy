import path from "node:path";

/** Каталог загрузок лежит в том же volume, что и база, — переживает пересборку образа. */
export function uploadsDir(): string {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mipsy.db");
  return path.join(path.dirname(dbPath), "uploads");
}
