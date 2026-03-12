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

### パラパラ動画ページの開発

`/paravi/` は `microCMS` 互換 API から動画一覧を取得します。開発時は `MICROCMS_BASE_URL` が未設定なら
`http://127.0.0.1:8080` を参照するため、同梱の mock サーバーだけで画面開発を進められます。

```bash
bun run mock:cms
```

別ターミナルで Astro を起動します。

```bash
bun run dev
```

本番の `microCMS` を使う場合は環境変数を設定してください。

```bash
export MICROCMS_BASE_URL="https://YOUR_SERVICE.microcms.io"
export MICROCMS_API_KEY="YOUR_API_KEY"
```

## ビルド（SSR）

サーバー出力をビルドするには:

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

## 追加した主なファイル

- `src/lib/videos.ts`: microCMS / mock API の取得処理
- `mock_microcms.py`: 開発用の 1 ファイル mock API
- `docs/microcms/videos.schema.json`: repo 上の microCMS スキーママスター
- `docs/microcms/README.md`: スキーマ更新の運用メモ

---

[Bun](https://bun.com) + [Astro](https://astro.build)
