## コミット・タグ・PR（AIエージェント向け）

- **コミット**: [Conventional Commits](https://www.conventionalcommits.org/) に従う。`feat:`, `fix:`, `docs:`, `chore:` などの type を付ける。
- **タグ**: [Calendar Versioning（CalVer）](https://calver.org/) を採用。形式は `YYYY.MM` または `YYYY.MM.MICRO`（例: `2025.3`, `2025.3.1`）。詳細はリポジトリルートの `CONTRIBUTING.md` を参照。
- **PR タイトル**: **英語**で書く。**PR 本文**: 原則**日本語**で書く。

## コミット前レビュー（サブエージェント）

コミット作成前に、**レビュー担当**として次の 3 点を実行する。

1. **自然言語の文法** — 変更した文章（README、コメント、UI 文言、ドキュメント等）の表記・文法を確認する。
2. **セキュリティ観点** — 機密情報の露出、インジェクション、不適切な依存の追加等がないか確認する。
3. **CI の確認** — `.github/workflows/` の該当ワークフローが通るか、必要なチェックが揃っているか確認する。

問題があれば修正してからコミットする。プロジェクトの `pre-commit-review` スキルがあればその手順に従う。

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
