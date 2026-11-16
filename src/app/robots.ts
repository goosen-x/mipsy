import type { MetadataRoute } from "next";
import { indexingAllowed, PRIVATE_PATHS, siteUrl } from "@/lib/indexing";

// Переменная окружения читается при каждом запросе, а не при сборке образа.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!indexingAllowed()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
