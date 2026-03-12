import type { MicroCmsVideoRecord, SyncVideoRecord } from "./types";

interface MicroCmsListResponse<T> {
  contents: T[];
  totalCount: number;
  limit: number;
  offset: number;
}

interface MicroCmsClientConfig {
  baseUrl: string;
  apiKey: string;
}

const DEFAULT_LIMIT = 100;

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function createHeaders(apiKey: string, includeJsonContentType = false): HeadersInit {
  return {
    Accept: "application/json",
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    "X-MICROCMS-API-KEY": apiKey,
  };
}

async function readErrorText(response: Response): Promise<string> {
  const text = await response.text();
  return text.trim().length > 0 ? text : `${response.status} ${response.statusText}`;
}

function normalizeVideoRecord(value: unknown): MicroCmsVideoRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid microCMS record.");
  }

  const record = value as Record<string, unknown>;
  const id = toOptionalString(record.id);
  const youtubeVideoId = toOptionalString(record.youtubeVideoId);
  const youtubeTitle = toOptionalString(record.youtubeTitle);
  const youtubePublishedAt = toOptionalString(record.youtubePublishedAt);

  if (!id || !youtubeVideoId || !youtubeTitle || !youtubePublishedAt) {
    throw new Error("microCMS record is missing required fields.");
  }

  return {
    id,
    youtubeVideoId,
    playlistItemId: toOptionalString(record.playlistItemId),
    youtubeTitle,
    youtubePublishedAt,
    displayTitle: toOptionalString(record.displayTitle),
    downloadUrl: toOptionalString(record.downloadUrl),
    isPublic: readBoolean(record.isPublic),
  };
}

async function fetchVideosPage(
  fetchFn: typeof fetch,
  config: MicroCmsClientConfig,
  offset: number
): Promise<MicroCmsListResponse<MicroCmsVideoRecord>> {
  const params = new URLSearchParams({
    limit: String(DEFAULT_LIMIT),
    offset: String(offset),
  });

  const response = await fetchFn(`${config.baseUrl}/api/v1/videos?${params.toString()}`, {
    headers: createHeaders(config.apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch microCMS videos: ${await readErrorText(response)}`);
  }

  const payload = (await response.json()) as MicroCmsListResponse<unknown>;
  return {
    contents: payload.contents.map(normalizeVideoRecord),
    totalCount: payload.totalCount,
    limit: payload.limit,
    offset: payload.offset,
  };
}

export async function fetchAllVideos(
  fetchFn: typeof fetch,
  config: MicroCmsClientConfig
): Promise<MicroCmsVideoRecord[]> {
  const videos: MicroCmsVideoRecord[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchVideosPage(fetchFn, config, offset);
    videos.push(...page.contents);

    offset += page.limit;
    if (offset >= page.totalCount || page.contents.length === 0) {
      return videos;
    }
  }
}

export async function createVideo(
  fetchFn: typeof fetch,
  config: MicroCmsClientConfig,
  record: SyncVideoRecord
): Promise<void> {
  const response = await fetchFn(`${config.baseUrl}/api/v1/videos`, {
    method: "POST",
    headers: createHeaders(config.apiKey, true),
    body: JSON.stringify({
      ...record,
      isPublic: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create a microCMS video: ${await readErrorText(response)}`);
  }
}

export async function updateVideo(
  fetchFn: typeof fetch,
  config: MicroCmsClientConfig,
  id: string,
  record: SyncVideoRecord
): Promise<void> {
  const response = await fetchFn(`${config.baseUrl}/api/v1/videos/${id}`, {
    method: "PATCH",
    headers: createHeaders(config.apiKey, true),
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error(`Failed to update microCMS video ${id}: ${await readErrorText(response)}`);
  }
}
