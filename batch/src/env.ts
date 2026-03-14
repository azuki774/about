export interface SyncEnvironment {
  youtubePlaylistId: string;
  microCmsBaseUrl: string;
  microCmsApiKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} is required.`);
  }

  return value;
}

export function readEnvironment(): SyncEnvironment {
  return {
    youtubePlaylistId: requireEnv("YOUTUBE_PLAYLIST_ID"),
    microCmsBaseUrl: requireEnv("MICROCMS_BASE_URL").replace(/\/+$/, ""),
    microCmsApiKey: requireEnv("MICROCMS_API_KEY"),
  };
}
