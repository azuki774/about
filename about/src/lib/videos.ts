export interface VideoRecord {
  id: string;
  youtubeVideoId: string;
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

function getEnvValue(name: "MICROCMS_BASE_URL" | "MICROCMS_API_KEY"): string | undefined {
  const buildTimeValue = toOptionalString(import.meta.env[name]);
  if (buildTimeValue) {
    return buildTimeValue;
  }

  return toOptionalString(process.env[name]);
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
    youtubeTitle,
    youtubePublishedAt,
    displayTitle: toOptionalString(record.displayTitle),
    downloadUrl: toOptionalString(record.downloadUrl),
    isPublic: Boolean(record.isPublic),
  };
}

function getMicroCmsBaseUrl(): string | undefined {
  const configuredBaseUrl = getEnvValue("MICROCMS_BASE_URL");
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return DEFAULT_DEV_BASE_URL;
  }

  return undefined;
}

function createHeaders(): HeadersInit {
  const apiKey = getEnvValue("MICROCMS_API_KEY");
  return apiKey ? { "X-MICROCMS-API-KEY": apiKey } : {};
}

async function fetchVideosPage(baseUrl: string, offset: number): Promise<MicroCmsListResponse<VideoRecord>> {
  const params = new URLSearchParams({
    limit: String(DEFAULT_LIMIT),
    offset: String(offset),
    filters: "isPublic[equals]true",
    orders: "-youtubePublishedAt",
  });

  const response = await fetch(`${baseUrl}/api/v1/videos?${params.toString()}`, {
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
  const baseUrl = getMicroCmsBaseUrl();
  if (!baseUrl) {
    console.error("[paravi] MICROCMS_BASE_URL is not configured.");
    return [];
  }

  const videos: VideoRecord[] = [];
  let offset = 0;

  try {
    while (true) {
      const page = await fetchVideosPage(baseUrl, offset);
      videos.push(...page.contents);

      offset += page.limit;
      if (offset >= page.totalCount || page.contents.length === 0) {
        break;
      }
    }

    return videos;
  } catch (error) {
    console.error("[paravi] Failed to fetch videos.", {
      baseUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function getVideoTitle(video: VideoRecord): string {
  return video.displayTitle ?? video.youtubeTitle;
}
