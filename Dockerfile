FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 собирается из исходников
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Схема нужна на этапе сборки: страницы читают БД при prerender
RUN mkdir -p data && node scripts/migrate.mjs && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
RUN mkdir -p data
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
