import type { SyncVideoRecord } from "./types";

export interface LoggerLike {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

interface PlaylistItemsResponse {
  items?: unknown[];
  nextPageToken?: string;
}

interface PlaylistVideoItem {
  id?: unknown;
  snippet?: {
    title?: unknown;
    resourceId?: {
      videoId?: unknown;
    };
  };
  contentDetails?: {
    videoPublishedAt?: unknown;
  };
}

const YOUTUBE_PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems";

function toRequiredString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePlaylistItem(value: unknown): SyncVideoRecord | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = value as PlaylistVideoItem;
  const playlistItemId = toRequiredString(item.id);
  const youtubeVideoId = toRequiredString(item.snippet?.resourceId?.videoId);
  const youtubeTitle = toRequiredString(item.snippet?.title);
  const youtubePublishedAt = toRequiredString(item.contentDetails?.videoPublishedAt);

  if (!playlistItemId || !youtubeVideoId || !youtubeTitle || !youtubePublishedAt) {
    return undefined;
  }

  return {
    playlistItemId,
    youtubeVideoId,
    youtubeTitle,
    youtubePublishedAt,
  };
}

async function readErrorText(response: Response): Promise<string> {
  const text = await response.text();
  return text.trim().length > 0 ? text : `${response.status} ${response.statusText}`;
}

export async function fetchPlaylistVideos(
  fetchFn: typeof fetch,
  apiKey: string,
  playlistId: string,
  logger: LoggerLike = console
): Promise<SyncVideoRecord[]> {
  const videos: SyncVideoRecord[] = [];
  const seenVideoIds = new Set<string>();
  let pageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      key: apiKey,
      maxResults: "50",
      part: "snippet,contentDetails,status",
      playlistId,
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetchFn(`${YOUTUBE_PLAYLIST_ITEMS_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube playlist items: ${await readErrorText(response)}`);
    }

    const payload = (await response.json()) as PlaylistItemsResponse;
    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      const parsed = parsePlaylistItem(item);
      if (!parsed) {
        logger.warn("Skipping an invalid playlist item from YouTube response.");
        continue;
      }

      if (seenVideoIds.has(parsed.youtubeVideoId)) {
        logger.warn(`Skipping a duplicated youtubeVideoId: ${parsed.youtubeVideoId}`);
        continue;
      }

      seenVideoIds.add(parsed.youtubeVideoId);
      videos.push(parsed);
    }

    pageToken = toRequiredString(payload.nextPageToken);
    if (!pageToken) {
      return videos;
    }
  }
}
