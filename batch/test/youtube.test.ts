import { expect, test } from "bun:test";

import { fetchPlaylistVideos } from "../src/youtube";

test("fetchPlaylistVideos paginates, deduplicates, and skips invalid items", async () => {
  const warnings: string[] = [];
  const responses = [
    {
      items: [
        {
          id: "playlist-item-001",
          snippet: {
            title: "First Video",
            resourceId: {
              videoId: "video-001",
            },
          },
          contentDetails: {
            videoPublishedAt: "2025-01-15T12:00:00.000Z",
          },
        },
        {
          id: "playlist-item-duplicate",
          snippet: {
            title: "Duplicate Video",
            resourceId: {
              videoId: "video-001",
            },
          },
          contentDetails: {
            videoPublishedAt: "2025-01-16T12:00:00.000Z",
          },
        },
        {
          id: "playlist-item-invalid",
          snippet: {
            title: "Invalid Video",
            resourceId: {
              videoId: "video-999",
            },
          },
          contentDetails: {},
        },
      ],
      nextPageToken: "NEXT",
    },
    {
      items: [
        {
          id: "playlist-item-002",
          snippet: {
            title: "Second Video",
            resourceId: {
              videoId: "video-002",
            },
          },
          contentDetails: {
            videoPublishedAt: "2025-02-01T12:00:00.000Z",
          },
        },
      ],
    },
  ];

  let callCount = 0;
  const fetchFn: typeof fetch = async () =>
    new Response(JSON.stringify(responses[callCount++]), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  const result = await fetchPlaylistVideos(fetchFn, "api-key", "playlist-id", {
    log: () => {},
    warn: (message) => warnings.push(String(message)),
  });

  expect(callCount).toBe(2);
  expect(result).toEqual([
    {
      playlistItemId: "playlist-item-001",
      youtubeVideoId: "video-001",
      youtubeTitle: "First Video",
      youtubePublishedAt: "2025-01-15T12:00:00.000Z",
    },
    {
      playlistItemId: "playlist-item-002",
      youtubeVideoId: "video-002",
      youtubeTitle: "Second Video",
      youtubePublishedAt: "2025-02-01T12:00:00.000Z",
    },
  ]);
  expect(warnings).toHaveLength(2);
});
