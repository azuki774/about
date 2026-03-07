FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app

COPY about/package.json about/bun.lock ./
RUN bun install --frozen-lockfile

COPY about/ .
RUN bun run build

FROM oven/bun:1.3.10-alpine AS prod-deps

WORKDIR /app

COPY about/package.json about/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.10-alpine AS runtime

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

CMD ["bun", "run", "./dist/server/entry.mjs"]
