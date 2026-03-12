export interface VideoRecord {
  id: string;
  youtubeVideoId: string;
  playlistItemId?: string;
  youtubeTitle: string;
  youtubePublishedAt: string;
  displayTitle?: string;
  downloadUrl?: string;
  isPublic: boolean;
}

interface MicroCmsListResponse<T> {
  contents: T[];
  totalCount: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_DEV_BASE_URL = "http://127.0.0.1:8080";

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeVideoRecord(value: unknown): VideoRecord {
  if (!value || typeof value !== "object") {
    throw new Error("動画データの形式が不正です。");
  }

  const record = value as Record<string, unknown>;
  const id = toOptionalString(record.id);
  const youtubeVideoId = toOptionalString(record.youtubeVideoId);
  const youtubeTitle = toOptionalString(record.youtubeTitle);
  const youtubePublishedAt = toOptionalString(record.youtubePublishedAt);

  if (!id || !youtubeVideoId || !youtubeTitle || !youtubePublishedAt) {
    throw new Error("動画データに必須項目が不足しています。");
  }

  return {
    id,
    youtubeVideoId,
    playlistItemId: toOptionalString(record.playlistItemId),
    youtubeTitle,
    youtubePublishedAt,
    displayTitle: toOptionalString(record.displayTitle),
    downloadUrl: toOptionalString(record.downloadUrl),
    isPublic: Boolean(record.isPublic),
  };
}

function getMicroCmsBaseUrl(): string {
  const configuredBaseUrl = toOptionalString(import.meta.env.MICROCMS_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return DEFAULT_DEV_BASE_URL;
  }

  throw new Error("MICROCMS_BASE_URL が設定されていません。");
}

function createHeaders(): HeadersInit {
  const apiKey = toOptionalString(import.meta.env.MICROCMS_API_KEY);
  return apiKey ? { "X-MICROCMS-API-KEY": apiKey } : {};
}

async function fetchVideosPage(offset: number): Promise<MicroCmsListResponse<VideoRecord>> {
  const params = new URLSearchParams({
    limit: String(DEFAULT_LIMIT),
    offset: String(offset),
    filters: "isPublic[equals]true",
    orders: "-youtubePublishedAt",
  });

  const response = await fetch(`${getMicroCmsBaseUrl()}/api/v1/videos?${params.toString()}`, {
    headers: createHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`動画一覧の取得に失敗しました: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as MicroCmsListResponse<unknown>;
  return {
    contents: payload.contents.map(normalizeVideoRecord),
    totalCount: payload.totalCount,
    limit: payload.limit,
    offset: payload.offset,
  };
}

export async function fetchPublicVideos(): Promise<VideoRecord[]> {
  const videos: VideoRecord[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchVideosPage(offset);
    videos.push(...page.contents);

    offset += page.limit;
    if (offset >= page.totalCount || page.contents.length === 0) {
      break;
    }
  }

  return videos;
}

export function getVideoTitle(video: VideoRecord): string {
  return video.displayTitle ?? video.youtubeTitle;
}
