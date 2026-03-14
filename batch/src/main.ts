import { readEnvironment } from "./env";
import { createVideo, fetchAllVideos, updateVideo } from "./microcms";
import { applySyncPlan, buildSyncPlan } from "./sync";
import { fetchPlaylistVideos } from "./youtube";

async function main(): Promise<void> {
  const env = readEnvironment();
  console.log("Starting YouTube to microCMS sync.");

  const [youtubeVideos, microCmsVideos] = await Promise.all([
    fetchPlaylistVideos(fetch, env.youtubePlaylistId),
    fetchAllVideos(fetch, {
      baseUrl: env.microCmsBaseUrl,
      apiKey: env.microCmsApiKey,
    }),
  ]);

  console.log(`Fetched ${youtubeVideos.length} videos from YouTube playlist.`);
  console.log(`Fetched ${microCmsVideos.length} videos from microCMS.`);

  const plan = buildSyncPlan(youtubeVideos, microCmsVideos);
  const summary = await applySyncPlan(
    plan,
    {
      createVideo: (record) =>
        createVideo(fetch, {
          baseUrl: env.microCmsBaseUrl,
          apiKey: env.microCmsApiKey,
        }, record),
      updateVideo: (id, record) =>
        updateVideo(fetch, {
          baseUrl: env.microCmsBaseUrl,
          apiKey: env.microCmsApiKey,
        }, id, record),
    }
  );

  console.log(
    `Sync completed. created=${summary.createdCount} updated=${summary.updatedCount} missing=${summary.missingCount}`
  );
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`Sync failed: ${error.message}`);
  } else {
    console.error("Sync failed with an unknown error.");
  }

  process.exitCode = 1;
});
