import type { SyncVideoRecord } from "./types";

export interface LoggerLike {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

interface PlaylistVideoItem {
  videoId?: unknown;
  title?: unknown;
  isPlayable?: unknown;
}

const YOUTUBE_PLAYLIST_URL = "https://www.youtube.com/playlist";
const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch";
const DEFAULT_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "User-Agent": "Mozilla/5.0",
};

function toRequiredString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as {
    simpleText?: unknown;
    runs?: Array<{
      text?: unknown;
    }>;
  };

  const simpleText = toRequiredString(candidate.simpleText);
  if (simpleText) {
    return simpleText;
  }

  const runs = Array.isArray(candidate.runs) ? candidate.runs : [];
  const text = runs
    .map((run) => toRequiredString(run.text))
    .filter((entry): entry is string => Boolean(entry))
    .join("");

  return text.length > 0 ? text : undefined;
}

function extractInitialData(html: string): unknown {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error("Failed to find ytInitialData in playlist page.");
  }

  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf(";</script>", jsonStart);
  if (jsonEnd < 0) {
    throw new Error("Failed to parse ytInitialData from playlist page.");
  }

  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

function collectPlaylistVideoItems(value: unknown, items: PlaylistVideoItem[] = []): PlaylistVideoItem[] {
  if (!value || typeof value !== "object") {
    return items;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectPlaylistVideoItems(entry, items);
    }

    return items;
  }

  const candidate = value as Record<string, unknown>;
  const renderer = candidate.playlistVideoRenderer;
  if (renderer && typeof renderer === "object") {
    items.push(renderer as PlaylistVideoItem);
  }

  for (const entry of Object.values(candidate)) {
    collectPlaylistVideoItems(entry, items);
  }

  return items;
}

function parsePlaylistItem(value: PlaylistVideoItem, playlistId: string): Omit<SyncVideoRecord, "youtubePublishedAt"> | undefined {
  if (value.isPlayable === false) {
    return undefined;
  }

  return {
    playlistItemId: `${playlistId}:${value.videoId}`,
    youtubeVideoId: toRequiredString(value.videoId) ?? "",
    youtubeTitle: extractText(value.title) ?? "",
  };
}

function normalizePlaylistItem(
  value: PlaylistVideoItem,
  playlistId: string
): Omit<SyncVideoRecord, "youtubePublishedAt"> | undefined {
  const parsed = parsePlaylistItem(value, playlistId);
  if (!parsed) {
    return undefined;
  }

  if (!parsed.youtubeVideoId || !parsed.youtubeTitle) {
    return undefined;
  }

  return parsed;
}

function normalizePublishedAt(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    return undefined;
  }

  return parsed.toISOString();
}

function extractUploadDate(html: string): string | undefined {
  const matches = [
    html.match(/"(?:uploadDate|publishDate)":"([^"]+)"/),
    html.match(/itemprop="(?:uploadDate|datePublished)" content="([^"]+)"/),
  ];

  for (const match of matches) {
    const value = match?.[1];
    if (!value) {
      continue;
    }

    const normalized = normalizePublishedAt(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.trim().length > 0 ? text : `${response.status} ${response.statusText}`;
}

async function fetchPlaylistPage(fetchFn: typeof fetch, playlistId: string): Promise<string> {
  const params = new URLSearchParams({
    list: playlistId,
  });
  const response = await fetchFn(`${YOUTUBE_PLAYLIST_URL}?${params.toString()}`, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube playlist page: ${await readErrorBody(response)}`);
  }

  return response.text();
}

async function fetchPublishedAt(fetchFn: typeof fetch, videoId: string): Promise<string | undefined> {
  const params = new URLSearchParams({
    v: videoId,
  });
  const response = await fetchFn(`${YOUTUBE_WATCH_URL}?${params.toString()}`, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube watch page: ${await readErrorBody(response)}`);
  }

  return extractUploadDate(await response.text());
}

async function mapConcurrent<T, TResult>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<TResult>
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= values.length) {
        return;
      }

      results[currentIndex] = await mapper(values[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function fetchPlaylistVideos(
  fetchFn: typeof fetch,
  playlistId: string,
  logger: LoggerLike = console
): Promise<SyncVideoRecord[]> {
  const html = await fetchPlaylistPage(fetchFn, playlistId);
  const initialData = extractInitialData(html);
  const scrapedItems = collectPlaylistVideoItems(initialData);
  const normalizedItems = scrapedItems
    .map((item) => normalizePlaylistItem(item, playlistId))
    .filter((item): item is Omit<SyncVideoRecord, "youtubePublishedAt"> => Boolean(item));

  const videos: Omit<SyncVideoRecord, "youtubePublishedAt">[] = [];
  const seenVideoIds = new Set<string>();

  for (const item of normalizedItems) {
    if (seenVideoIds.has(item.youtubeVideoId)) {
      logger.warn(`Skipping a duplicated youtubeVideoId: ${item.youtubeVideoId}`);
      continue;
    }

    seenVideoIds.add(item.youtubeVideoId);
    videos.push(item);
  }

  const publishedVideos = await mapConcurrent(videos, 5, async (video) => {
    try {
      const publishedAt = await fetchPublishedAt(fetchFn, video.youtubeVideoId);
      if (!publishedAt) {
        logger.warn(`Skipping video without uploadDate: ${video.youtubeVideoId}`);
        return undefined;
      }

      return {
        ...video,
        youtubePublishedAt: publishedAt,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown error";
      logger.warn(`Skipping video with failed watch page fetch: ${video.youtubeVideoId} (${message})`);
      return undefined;
    }
  });

  return publishedVideos.filter((video): video is SyncVideoRecord => Boolean(video));
}
