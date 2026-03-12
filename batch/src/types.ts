export interface SyncVideoRecord {
  youtubeVideoId: string;
  playlistItemId: string;
  youtubeTitle: string;
  youtubePublishedAt: string;
}

export interface MicroCmsVideoRecord {
  id: string;
  youtubeVideoId: string;
  playlistItemId?: string;
  youtubeTitle: string;
  youtubePublishedAt: string;
  displayTitle?: string;
  downloadUrl?: string;
  isPublic: boolean;
}

export interface SyncPlan {
  toCreate: SyncVideoRecord[];
  toUpdate: Array<{
    id: string;
    payload: SyncVideoRecord;
  }>;
  missingFromPlaylist: MicroCmsVideoRecord[];
}
