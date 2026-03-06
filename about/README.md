# about

To install dependencies:

```bash
bun install
```

## 開発

開発サーバー（ホットリロード）:

```bash
bun run dev
```

ブラウザで http://localhost:4321 を開く。

## ビルド（SSG）

静的サイトをビルドするには:

```bash
bun run build
```

- 出力先: `dist/`
- プレビュー: `bun run preview` でビルド結果をローカル配信

## ページの追加

Astro はファイルベースルーティングです。`src/pages/` に `.astro` や `.md` を置くとそのパスで公開されます。

- `src/pages/index.astro` → `/`
- `src/pages/about.astro` → `/about/`
- `src/pages/blog/post.md` → `/blog/post/`

共通レイアウトは `src/layouts/BaseLayout.astro` を各ページで import して使用します。

---

[Bun](https://bun.com) + [Astro](https://astro.build)
