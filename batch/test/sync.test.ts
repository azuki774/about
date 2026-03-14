import { expect, test } from "bun:test";

import { applySyncPlan, buildSyncPlan } from "../src/sync";
import type { MicroCmsVideoRecord, SyncVideoRecord } from "../src/types";

test("buildSyncPlan creates and updates only changed records", () => {
  const youtubeVideos: SyncVideoRecord[] = [
    {
      youtubeVideoId: "video-001",
      youtubeTitle: "First Video",
      youtubePublishedAt: "2025-01-15T12:00:00.000Z",
    },
    {
      youtubeVideoId: "video-002",
      youtubeTitle: "Second Video Updated",
      youtubePublishedAt: "2025-02-01T12:00:00.000Z",
    },
    {
      youtubeVideoId: "video-003",
      youtubeTitle: "Third Video",
      youtubePublishedAt: "2025-03-01T12:00:00.000Z",
    },
  ];

  const existingVideos: MicroCmsVideoRecord[] = [
    {
      id: "record-001",
      youtubeVideoId: "video-001",
      youtubeTitle: "First Video",
      youtubePublishedAt: "2025-01-15T12:00:00.000Z",
      displayTitle: "Manual Title",
      downloadUrl: "https://example.com/1",
      isPublic: true,
    },
    {
      id: "record-002",
      youtubeVideoId: "video-002",
      youtubeTitle: "Second Video",
      youtubePublishedAt: "2025-02-01T12:00:00.000Z",
      displayTitle: "Keep This",
      isPublic: false,
    },
    {
      id: "record-999",
      youtubeVideoId: "video-999",
      youtubeTitle: "Old Video",
      youtubePublishedAt: "2024-12-31T12:00:00.000Z",
      isPublic: true,
    },
  ];

  const plan = buildSyncPlan(youtubeVideos, existingVideos);

  expect(plan.toCreate).toEqual([youtubeVideos[2]]);
  expect(plan.toUpdate).toEqual([
    {
      id: "record-002",
      payload: youtubeVideos[1],
    },
  ]);
  expect(plan.missingFromPlaylist).toEqual([existingVideos[2]]);
});

test("buildSyncPlan fails when microCMS has duplicated youtubeVideoId", () => {
  const youtubeVideos: SyncVideoRecord[] = [];
  const existingVideos: MicroCmsVideoRecord[] = [
    {
      id: "record-001",
      youtubeVideoId: "video-001",
      youtubeTitle: "First Video",
      youtubePublishedAt: "2025-01-15T12:00:00.000Z",
      isPublic: true,
    },
    {
      id: "record-002",
      youtubeVideoId: "video-001",
      youtubeTitle: "Duplicated Video",
      youtubePublishedAt: "2025-01-16T12:00:00.000Z",
      isPublic: true,
    },
  ];

  expect(() => buildSyncPlan(youtubeVideos, existingVideos)).toThrow(
    "Duplicate youtubeVideoId found in microCMS: video-001"
  );
});

test("applySyncPlan sends creates and updates while only logging missing records", async () => {
  const created: SyncVideoRecord[] = [];
  const updated: Array<{ id: string; record: SyncVideoRecord }> = [];
  const warnings: string[] = [];
  const logs: string[] = [];

  const plan = {
    toCreate: [
      {
        youtubeVideoId: "video-003",
        youtubeTitle: "Third Video",
        youtubePublishedAt: "2025-03-01T12:00:00.000Z",
      },
    ],
    toUpdate: [
      {
        id: "record-002",
        payload: {
          youtubeVideoId: "video-002",
          youtubeTitle: "Second Video Updated",
          youtubePublishedAt: "2025-02-01T12:00:00.000Z",
        },
      },
    ],
    missingFromPlaylist: [
      {
        id: "record-999",
        youtubeVideoId: "video-999",
        youtubeTitle: "Old Video",
        youtubePublishedAt: "2024-12-31T12:00:00.000Z",
        isPublic: true,
      },
    ],
  };

  const summary = await applySyncPlan(
    plan,
    {
      createVideo: async (record) => {
        created.push(record);
      },
      updateVideo: async (id, record) => {
        updated.push({ id, record });
      },
    },
    {
      log: (message) => logs.push(String(message)),
      warn: (message) => warnings.push(String(message)),
    }
  );

  expect(created).toEqual(plan.toCreate);
  expect(updated).toEqual([
    {
      id: "record-002",
      record: plan.toUpdate[0].payload,
    },
  ]);
  expect(warnings).toHaveLength(1);
  expect(logs).toHaveLength(2);
  expect(summary).toEqual({
    createdCount: 1,
    updatedCount: 1,
    missingCount: 1,
  });
});
