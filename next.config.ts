import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async redirects() {
    // Кабинет оператора переехал: /op → /admin, старые закладки живут.
    return [
      { source: "/op", destination: "/admin", permanent: false },
      { source: "/op/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
