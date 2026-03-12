# microCMS schema notes

このディレクトリは、`about/about` で利用する `microCMS` スキーマのマスターを置く場所です。

## 方針

- `videos.schema.json` を repo 上のスキーママスターとして扱う
- `src/lib/videos.ts` の取得型と検証は、この JSON に合わせて保守する
- `microCMS` 管理画面の変更を行ったら、この JSON も更新して同じコミットに含める

## 対象API

- Endpoint: `videos`
- 用途: `/paravi/` に表示する動画一覧の公開マスタ
- デフォルト取得条件:
  - `filters=isPublic[equals]true`
  - `orders=-youtubePublishedAt`

## 運用ルール

1. `microCMS` 管理画面で `videos` API のスキーマを変更する
2. `docs/microcms/videos.schema.json` を同じ内容に更新する
3. 必要なら `src/lib/videos.ts` の型と正規化ロジックを更新する
4. `astro build` を通して、画面側の破綻がないことを確認する

## 実データ側の責務

- YouTube同期で更新する項目:
  - `youtubeVideoId`
  - `playlistItemId`
  - `youtubeTitle`
  - `youtubePublishedAt`
- 手編集する項目:
  - `displayTitle`
  - `downloadUrl`
  - `isPublic`

## 補足

- この JSON は `microCMS` のエクスポートをそのまま保存するものではなく、repo 上で人とコードが追いやすい簡潔な定義ファイルです
- もし将来 `microCMS` の Management API やエクスポートJSONを使って厳密な差分確認をしたくなったら、このディレクトリに追加してください
