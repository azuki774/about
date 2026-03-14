# about-paravi-sync

公開された YouTube プレイリストから動画情報を取得し、`microCMS` の `videos` API へ同期するバッチコンテナです。

## 使い方

```bash
cd batch
bun run ./src/main.ts
```

## 必須環境変数

- `YOUTUBE_PLAYLIST_ID`
- `MICROCMS_BASE_URL`
- `MICROCMS_API_KEY`

`MICROCMS_BASE_URL` は `https://YOUR_SERVICE.microcms.io` の形式を想定します。

```bash
export YOUTUBE_PLAYLIST_ID="PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export MICROCMS_BASE_URL="https://YOUR_SERVICE.microcms.io"
export MICROCMS_API_KEY="YOUR_MICROCMS_API_KEY"
```

`YOUTUBE_PLAYLIST_ID` には、プレイリスト URL の `list` パラメータの値をそのまま入れます。

例:

```text
https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 同期ルール

- 照合キーは `youtubeVideoId`
- 更新対象は `youtubeVideoId`, `youtubeTitle`, `youtubePublishedAt`
- `displayTitle`, `downloadUrl` は更新しない
- 既存にない動画は `isPublic=true` で新規作成する
- `microCMS` にだけ存在する動画は削除せず、差分ログだけ出す

## 注意

- `YOUTUBE_PLAYLIST_ID` は公開プレイリストを指定してください
- 取得対象はプレイリストの最新 100 件までです
- `youtubePublishedAt` は watch page の `uploadDate` または `publishDate` を使います
- watch page で日付しか取得できない場合、時刻は `00:00:00.000Z` になります
