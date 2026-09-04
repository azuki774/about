import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

export interface Photo {
  key: string;
  basename: string;
  lastModified: Date;
  year: number;
  month: number;
}

export interface PhotoGroup {
  year: number;
  month: number;
  photos: Photo[];
}

export interface PhotosConfig {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export interface PhotoListing {
  groups: PhotoGroup[];
  skippedCount: number;
}

interface ParsedPhotoKey {
  year: number;
  month: number;
  basename: string;
}

type PhotosEnvName =
  | "PHOTOS_S3_BUCKET"
  | "PHOTOS_S3_ENDPOINT"
  | "PHOTOS_S3_REGION"
  | "PHOTOS_S3_ACCESS_KEY_ID"
  | "PHOTOS_S3_SECRET_ACCESS_KEY"
  | "PHOTOS_PUBLIC_BASE_URL";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const PHOTO_KEY_PATTERN = /^(\d{4})\/(\d{2})\/(.+)$/;
const DEFAULT_REGION = "auto";
const DEFAULT_PUBLIC_BASE_URL = "https://about-photos-s.azuki.blue";

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getEnvValue(name: PhotosEnvName): string | undefined {
  const buildTimeEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  const buildTimeValue = buildTimeEnv ? toOptionalString(buildTimeEnv[name]) : undefined;
  if (buildTimeValue) {
    return buildTimeValue;
  }

  return toOptionalString(process.env[name]);
}

export function getPhotosPublicBaseUrl(): string {
  return (getEnvValue("PHOTOS_PUBLIC_BASE_URL") ?? DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, "");
}

export function readPhotosConfig(): PhotosConfig | null {
  const bucket = getEnvValue("PHOTOS_S3_BUCKET");
  const endpoint = getEnvValue("PHOTOS_S3_ENDPOINT");
  const accessKeyId = getEnvValue("PHOTOS_S3_ACCESS_KEY_ID");
  const secretAccessKey = getEnvValue("PHOTOS_S3_SECRET_ACCESS_KEY");

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: getEnvValue("PHOTOS_S3_REGION") ?? DEFAULT_REGION,
    publicBaseUrl: getPhotosPublicBaseUrl(),
  };
}

export function parsePhotoKey(key: string): ParsedPhotoKey | null {
  const match = PHOTO_KEY_PATTERN.exec(key);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const name = match[3];

  if (month < 1 || month > 12 || name.includes("/")) {
    return null;
  }

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const extension = name.slice(dotIndex + 1).toLowerCase();
  const basename = name.slice(0, dotIndex);

  if (!IMAGE_EXTENSIONS.has(extension) || basename.length === 0) {
    return null;
  }

  return { year, month, basename };
}

export function toPhoto(key: string, lastModified: Date): Photo | null {
  const parsed = parsePhotoKey(key);
  if (!parsed || Number.isNaN(lastModified.getTime())) {
    return null;
  }

  return {
    key,
    basename: parsed.basename,
    lastModified,
    year: parsed.year,
    month: parsed.month,
  };
}

export function comparePhotosDesc(a: Photo, b: Photo): number {
  if (a.year !== b.year) {
    return b.year - a.year;
  }
  if (a.month !== b.month) {
    return b.month - a.month;
  }
  return b.lastModified.getTime() - a.lastModified.getTime();
}

export function groupPhotosByMonth(photos: Photo[]): PhotoGroup[] {
  const groups: PhotoGroup[] = [];

  for (const photo of photos) {
    const last = groups[groups.length - 1];
    if (last && last.year === photo.year && last.month === photo.month) {
      last.photos.push(photo);
    } else {
      groups.push({ year: photo.year, month: photo.month, photos: [photo] });
    }
  }

  return groups;
}

export function getOriginalPhotoUrl(publicBaseUrl: string, key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl.replace(/\/+$/, "")}/${encoded}`;
}

export function getDisplayPhotoUrl(publicBaseUrl: string, key: string, width: number, dev: boolean): string {
  const original = getOriginalPhotoUrl(publicBaseUrl, key);
  if (dev) {
    return original;
  }

  const options = `width=${width},fit=scale-down,format=auto,metadata=none`;
  return `/cdn-cgi/image/${options}/${encodeURIComponent(original)}`;
}

export async function listPhotos(config: PhotosConfig): Promise<PhotoListing> {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const photos: Photo[] = [];
  let skippedCount = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          ContinuationToken: continuationToken,
        })
      );

      for (const object of response.Contents ?? []) {
        const photo = object.Key && object.LastModified ? toPhoto(object.Key, object.LastModified) : null;
        if (photo) {
          photos.push(photo);
        } else {
          skippedCount += 1;
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  } finally {
    client.destroy();
  }

  photos.sort(comparePhotosDesc);
  return { groups: groupPhotosByMonth(photos), skippedCount };
}

export async function fetchPhotoListing(): Promise<PhotoListing | null> {
  const config = readPhotosConfig();
  if (!config) {
    console.warn("[photos] PHOTOS_S3_* is not configured.");
    return null;
  }

  try {
    return await listPhotos(config);
  } catch (error) {
    console.warn("[photos] Failed to list photos.", {
      bucket: config.bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
