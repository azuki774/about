import type { MicroCmsVideoRecord, SyncPlan, SyncVideoRecord } from "./types";

export interface LoggerLike {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export interface SyncTarget {
  createVideo: (record: SyncVideoRecord) => Promise<void>;
  updateVideo: (id: string, record: SyncVideoRecord) => Promise<void>;
}

export interface SyncSummary {
  createdCount: number;
  updatedCount: number;
  missingCount: number;
}

function hasChanged(existing: MicroCmsVideoRecord, incoming: SyncVideoRecord): boolean {
  return (
    existing.youtubeTitle !== incoming.youtubeTitle ||
    existing.youtubePublishedAt !== incoming.youtubePublishedAt
  );
}

function indexExistingVideos(videos: MicroCmsVideoRecord[]): Map<string, MicroCmsVideoRecord> {
  const indexed = new Map<string, MicroCmsVideoRecord>();

  for (const video of videos) {
    if (indexed.has(video.youtubeVideoId)) {
      throw new Error(`Duplicate youtubeVideoId found in microCMS: ${video.youtubeVideoId}`);
    }

    indexed.set(video.youtubeVideoId, video);
  }

  return indexed;
}

export function buildSyncPlan(youtubeVideos: SyncVideoRecord[], existingVideos: MicroCmsVideoRecord[]): SyncPlan {
  const existingByVideoId = indexExistingVideos(existingVideos);
  const youtubeVideoIds = new Set<string>();
  const toCreate: SyncVideoRecord[] = [];
  const toUpdate: Array<{ id: string; payload: SyncVideoRecord }> = [];

  for (const video of youtubeVideos) {
    youtubeVideoIds.add(video.youtubeVideoId);
    const existing = existingByVideoId.get(video.youtubeVideoId);

    if (!existing) {
      toCreate.push(video);
      continue;
    }

    if (hasChanged(existing, video)) {
      toUpdate.push({
        id: existing.id,
        payload: video,
      });
    }
  }

  const missingFromPlaylist = existingVideos.filter((video) => !youtubeVideoIds.has(video.youtubeVideoId));

  return {
    toCreate,
    toUpdate,
    missingFromPlaylist,
  };
}

export async function applySyncPlan(
  plan: SyncPlan,
  target: SyncTarget,
  logger: LoggerLike = console
): Promise<SyncSummary> {
  for (const video of plan.toCreate) {
    logger.log(`Creating microCMS video for youtubeVideoId=${video.youtubeVideoId}`);
    await target.createVideo(video);
  }

  for (const update of plan.toUpdate) {
    logger.log(`Updating microCMS video id=${update.id} youtubeVideoId=${update.payload.youtubeVideoId}`);
    await target.updateVideo(update.id, update.payload);
  }

  for (const video of plan.missingFromPlaylist) {
    logger.warn(`Video exists in microCMS but not in playlist: id=${video.id} youtubeVideoId=${video.youtubeVideoId}`);
  }

  return {
    createdCount: plan.toCreate.length,
    updatedCount: plan.toUpdate.length,
    missingCount: plan.missingFromPlaylist.length,
  };
}
