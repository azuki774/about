# sync batch

YouTube のプレイリストから動画情報を取得し、`microCMS` の `videos` API へ同期するバッチです。

## 使い方

```bash
cd batch
bun run ./src/main.ts
```

## 必須環境変数

- `YOUTUBE_API_KEY`
- `YOUTUBE_PLAYLIST_ID`
- `MICROCMS_BASE_URL`
- `MICROCMS_API_KEY`

`MICROCMS_BASE_URL` は `https://YOUR_SERVICE.microcms.io` の形式を想定します。

## 同期ルール

- 照合キーは `youtubeVideoId`
- 更新対象は `youtubeVideoId`, `playlistItemId`, `youtubeTitle`, `youtubePublishedAt`
- `displayTitle`, `downloadUrl` は更新しない
- 既存にない動画は `isPublic=true` で新規作成する
- `microCMS` にだけ存在する動画は削除せず、差分ログだけ出す
