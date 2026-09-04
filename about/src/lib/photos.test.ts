import { describe, expect, test } from "bun:test";
import {
  comparePhotosDesc,
  getDisplayPhotoUrl,
  getOriginalPhotoUrl,
  groupPhotosByMonth,
  parsePhotoKey,
  toPhoto,
} from "./photos";

function photo(key: string, lastModified: string) {
  const parsed = toPhoto(key, new Date(lastModified));
  if (!parsed) {
    throw new Error(`invalid test key: ${key}`);
  }
  return parsed;
}

describe("parsePhotoKey", () => {
  test("accepts flat keys with supported image extensions", () => {
    expect(parsePhotoKey("2026/08/DSC_1234.jpg")).toEqual({ year: 2026, month: 8, basename: "DSC_1234" });
    expect(parsePhotoKey("2026/12/photo.png")).toEqual({ year: 2026, month: 12, basename: "photo" });
    expect(parsePhotoKey("2026/01/IMG_0001.JPEG")).toEqual({ year: 2026, month: 1, basename: "IMG_0001" });
    expect(parsePhotoKey("2026/03/hello world.webp")).toEqual({ year: 2026, month: 3, basename: "hello world" });
  });

  test("rejects keys that do not follow the YYYY/MM rule", () => {
    expect(parsePhotoKey("2026/8/DSC_1234.jpg")).toBeNull();
    expect(parsePhotoKey("2026/13/DSC_1234.jpg")).toBeNull();
    expect(parsePhotoKey("2026/00/DSC_1234.jpg")).toBeNull();
    expect(parsePhotoKey("2026/08/2026/08/DSC_1234.jpg")).toBeNull();
    expect(parsePhotoKey("DSC_1234.jpg")).toBeNull();
    expect(parsePhotoKey("2026/08/")).toBeNull();
  });

  test("rejects unsupported extensions and missing names", () => {
    expect(parsePhotoKey("2026/08/DSC_1234.gif")).toBeNull();
    expect(parsePhotoKey("2026/08/DSC_1234")).toBeNull();
    expect(parsePhotoKey("2026/08/.jpg")).toBeNull();
  });
});

describe("toPhoto", () => {
  test("builds a photo from a valid key and timestamp", () => {
    const lastModified = new Date("2026-09-01T00:00:00Z");
    expect(toPhoto("2026/08/DSC_1234.jpg", lastModified)).toEqual({
      key: "2026/08/DSC_1234.jpg",
      basename: "DSC_1234",
      lastModified,
      year: 2026,
      month: 8,
    });
  });

  test("returns null for invalid keys", () => {
    expect(toPhoto("invalid.jpg", new Date())).toBeNull();
  });
});

describe("comparePhotosDesc / groupPhotosByMonth", () => {
  test("sorts by month desc then LastModified desc and groups consecutive months", () => {
    const photos = [
      photo("2026/08/a.jpg", "2026-08-01T09:00:00Z"),
      photo("2026/09/b.jpg", "2026-09-03T09:00:00Z"),
      photo("2026/09/c.jpg", "2026-09-02T09:00:00Z"),
      photo("2025/12/d.jpg", "2025-12-01T09:00:00Z"),
    ].sort(comparePhotosDesc);

    expect(photos.map((p) => p.key)).toEqual([
      "2026/09/b.jpg",
      "2026/09/c.jpg",
      "2026/08/a.jpg",
      "2025/12/d.jpg",
    ]);

    const groups = groupPhotosByMonth(photos);
    expect(groups.map((g) => `${g.year}-${g.month}`)).toEqual(["2026-9", "2026-8", "2025-12"]);
    expect(groups[0].photos.map((p) => p.key)).toEqual(["2026/09/b.jpg", "2026/09/c.jpg"]);
  });
});

describe("URL generation", () => {
  const base = "https://about-photos-s.azuki.blue";

  test("encodes each path segment of the original URL", () => {
    expect(getOriginalPhotoUrl(base, "2026/08/hello world.jpg")).toBe(
      "https://about-photos-s.azuki.blue/2026/08/hello%20world.jpg"
    );
  });

  test("trims trailing slashes of the base URL", () => {
    expect(getOriginalPhotoUrl("https://about-photos-s.azuki.blue/", "2026/08/a.jpg")).toBe(
      "https://about-photos-s.azuki.blue/2026/08/a.jpg"
    );
  });

  test("returns the original URL in dev mode", () => {
    expect(getDisplayPhotoUrl(base, "2026/08/a.jpg", 640, true)).toBe(
      "https://about-photos-s.azuki.blue/2026/08/a.jpg"
    );
  });

  test("builds a /cdn-cgi/image URL in production mode", () => {
    const original = "https://about-photos-s.azuki.blue/2026/08/a.jpg";
    expect(getDisplayPhotoUrl(base, "2026/08/a.jpg", 640, false)).toBe(
      `/cdn-cgi/image/width=640,fit=scale-down,format=auto,metadata=none/${encodeURIComponent(original)}`
    );
  });
});
