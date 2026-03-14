import { expect, test } from "bun:test";

import { fetchPlaylistVideos } from "../src/youtube";

test("fetchPlaylistVideos scrapes playlist HTML, deduplicates, and skips videos without uploadDate", async () => {
  const warnings: string[] = [];
  const playlistHtml = `<!DOCTYPE html><html><body><script>var ytInitialData = ${JSON.stringify({
    contents: {
      playlistVideoListRenderer: {
        contents: [
          {
            playlistVideoRenderer: {
              videoId: "video-001",
              title: {
                runs: [{ text: "First Video" }],
              },
            },
          },
          {
            playlistVideoRenderer: {
              videoId: "video-001",
              title: {
                runs: [{ text: "Duplicate Video" }],
              },
            },
          },
          {
            playlistVideoRenderer: {
              videoId: "video-002",
              title: {
                simpleText: "Second Video",
              },
            },
          },
          {
            playlistVideoRenderer: {
              videoId: "video-003",
              title: {
                runs: [{ text: "Missing Upload Date" }],
              },
            },
          },
          {
            playlistVideoRenderer: {
              title: {
                runs: [{ text: "Invalid Video" }],
              },
            },
          },
        ],
      },
    },
  })};</script></body></html>`;

  const videoPages = new Map<string, string>([
    ["video-001", '<meta itemprop="uploadDate" content="2025-01-15T12:34:56-07:00">'],
    ["video-002", '<script type="application/ld+json">{"publishDate":"2025-02-01"}</script>'],
    ["video-003", "<html></html>"],
  ]);

  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);

    if (url.pathname === "/playlist") {
      return new Response(playlistHtml, {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    if (url.pathname === "/watch") {
      const videoId = url.searchParams.get("v") ?? "";
      const body = videoPages.get(videoId);
      return new Response(body ?? "", {
        status: body ? 200 : 404,
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    return new Response("not found", { status: 404 });
  };

  const result = await fetchPlaylistVideos(fetchFn, "playlist-id", {
    log: () => {},
    warn: (message) => warnings.push(String(message)),
  });

  expect(result).toEqual([
    {
      playlistItemId: "playlist-id:video-001",
      youtubeVideoId: "video-001",
      youtubeTitle: "First Video",
      youtubePublishedAt: "2025-01-15T19:34:56.000Z",
    },
    {
      playlistItemId: "playlist-id:video-002",
      youtubeVideoId: "video-002",
      youtubeTitle: "Second Video",
      youtubePublishedAt: "2025-02-01T00:00:00.000Z",
    },
  ]);
  expect(warnings).toHaveLength(2);
});
