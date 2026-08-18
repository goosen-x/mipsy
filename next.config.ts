import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Сканы дипломов и фото уходят server-action'ом; по умолчанию лимит тела
    // 1 МБ — файл больше просто обрывал запрос («unexpected response»).
    // 12 МБ = наши 10 МБ на файл + запас на multipart-обвязку.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async redirects() {
    // Кабинет оператора переехал: /op → /admin, старые закладки живут.
    return [
      { source: "/op", destination: "/admin", permanent: false },
      { source: "/op/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
