import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db, psychologists } from "@/db";
import { siteUrl } from "@/lib/indexing";

export const dynamic = "force-dynamic";

/** Публичные страницы и профили одобренных психологов. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/psihologi", "/how", "/prices", "/about", "/faq", "/psihologam", "/crisis", "/rules"].map(
    (path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 }),
  );
  const profiles = await db
    .select({ slug: psychologists.slug })
    .from(psychologists)
    .where(and(eq(psychologists.moderationStatus, "approved"), eq(psychologists.hidden, false)));
  return [
    ...pages,
    ...profiles
      .filter((p) => p.slug)
      .map((p) => ({ url: `${base}/psihologi/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
