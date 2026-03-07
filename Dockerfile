FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app

COPY about/package.json about/bun.lock ./
RUN bun install --frozen-lockfile

COPY about/ .
RUN bun run build

FROM oven/bun:1.3.10-alpine AS runtime

WORKDIR /app

COPY --from=build /app/dist ./dist

EXPOSE 4321

CMD ["bun", "run", "./dist/server/entry.mjs"]
