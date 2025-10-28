import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

type StorageDriver = "local" | "r2";

type SaveResult = {
  fileName: string;
  url: string;
  storageType: StorageDriver;
  size: number;
  width: number | null;
  height: number | null;
  thumbnailFileName: string;
  thumbnailUrl: string;
  thumbnailSize: number;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
};

type ProcessedImage = {
  data: Buffer;
  info: sharp.OutputInfo;
};

type R2Config = {
  bucket: string;
  endpoint: string;
  baseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type SaveMediaOptions = {
  directory?: string;
};

const globalScope = globalThis as unknown as {
  __r2Client?: S3Client | null;
};

function resolveStorageDriver(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  return raw === "r2" ? "r2" : "local";
}

const STORAGE_DRIVER = resolveStorageDriver();

function buildThumbnailName(fileName: string) {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, ext.length ? -ext.length : undefined);
  return `${base}-thumb${ext}`;
}

function resolveBaseDirectory(directory: string) {
  return path.join(process.cwd(), "public", directory);
}

function normalizeDirectory(directory?: string) {
  const raw = directory?.trim() ?? "";
  const sanitized = raw.replace(/^\/+|\/+$/g, "");
  return sanitized.length > 0 ? sanitized : "uploads";
}

function toRelativePath(directory: string, fileName: string) {
  if (directory === "uploads") {
    return fileName;
  }
  return path.posix.join(directory, fileName);
}

function buildPublicPath(directory: string, fileName: string) {
  const joined = path.posix.join(directory, fileName);
  return `/${joined}`;
}

function ensureAbsoluteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function sanitizeBaseUrl(value: string) {
  const absolute = ensureAbsoluteUrl(value);
  return absolute.replace(/\/+$/, "");
}

function getDefaultR2Endpoint(accountId: string | undefined) {
  if (!accountId) return null;
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function ensureR2Config(): R2Config {
  const bucket = process.env.R2_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ?? getDefaultR2Endpoint(accountId ?? undefined);

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "Konfigurasi R2 tidak lengkap. Pastikan R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_ENDPOINT atau R2_ACCOUNT_ID terisi."
    );
  }

  const baseUrlRaw =
    process.env.R2_PUBLIC_BASE_URL?.trim() ??
    `${sanitizeBaseUrl(endpoint)}/${bucket}`;

  return {
    bucket,
    endpoint: sanitizeBaseUrl(endpoint),
    baseUrl: sanitizeBaseUrl(baseUrlRaw),
    accessKeyId,
    secretAccessKey,
  };
}

function getR2Client(config: R2Config): S3Client {
  if (!globalScope.__r2Client) {
    globalScope.__r2Client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return globalScope.__r2Client;
}

function deriveObjectKey(directory: string, fileName: string) {
  return path.posix.join(directory, fileName);
}

function buildPublicUrl(baseUrl: string, key: string) {
  return `${sanitizeBaseUrl(baseUrl)}/${key.replace(/^\/+/, "")}`;
}

export function deriveThumbnailUrl(url: string): string | null {
  if (!url) return null;
  const [pathPart, rest] = url.split(/(?=[?#])/);
  const segments = pathPart.split("/");
  const fileName = segments.pop();
  if (!fileName) return null;
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== ".webp") {
    return null;
  }
  const thumbName = buildThumbnailName(fileName);
  const newPath = [...segments, thumbName].join("/");
  return rest ? `${newPath}${rest}` : newPath;
}

async function processImageVariants(input: Buffer) {
  const main = (await sharp(input)
    .rotate()
    .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true })) as ProcessedImage;

  const thumb = (await sharp(input)
    .rotate()
    .resize({ width: 720, height: 360, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true })) as ProcessedImage;

  return { main, thumb };
}

async function persistLocal(
  directory: string,
  mainFileName: string,
  thumbFileName: string,
  main: ProcessedImage,
  thumb: ProcessedImage
) {
  const baseDir = resolveBaseDirectory(directory);
  await fs.mkdir(baseDir, { recursive: true });

  const mainPath = path.join(baseDir, mainFileName);
  const thumbPath = path.join(baseDir, thumbFileName);

  try {
    await fs.writeFile(mainPath, main.data);
    await fs.writeFile(thumbPath, thumb.data);
  } catch (error) {
    await fs.unlink(mainPath).catch(() => {});
    await fs.unlink(thumbPath).catch(() => {});
    throw error;
  }

  return { mainPath, thumbPath };
}

async function persistR2(
  directory: string,
  mainFileName: string,
  thumbFileName: string,
  main: ProcessedImage,
  thumb: ProcessedImage
) {
  const config = ensureR2Config();
  const client = getR2Client(config);

  const mainKey = deriveObjectKey(directory, mainFileName);
  const thumbKey = deriveObjectKey(directory, thumbFileName);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: mainKey,
        Body: main.data,
        ContentType: "image/webp",
      })
    );
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: thumbKey,
        Body: thumb.data,
        ContentType: "image/webp",
      })
    );
  } catch (error) {
    await client
      .send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: mainKey,
        })
      )
      .catch(() => {});
    await client
      .send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: thumbKey,
        })
      )
      .catch(() => {});
    throw error;
  }

  return {
    mainKey,
    thumbKey,
    baseUrl: config.baseUrl,
    bucket: config.bucket,
  };
}

export async function saveMediaFile(file: File, options?: SaveMediaOptions): Promise<SaveResult> {
  const directory = normalizeDirectory(options?.directory);

  const uniqueBase = `${Date.now()}-${randomUUID()}`;
  const extension = ".webp";
  const mainFileName = `${uniqueBase}${extension}`;
  const thumbFileName = buildThumbnailName(mainFileName);

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const { main, thumb } = await processImageVariants(inputBuffer);

    if (STORAGE_DRIVER === "r2") {
      const { mainKey, thumbKey, baseUrl } = await persistR2(
        directory,
        mainFileName,
        thumbFileName,
        main,
        thumb
      );

      const relativeMain = toRelativePath(directory, mainFileName);
      const relativeThumb = toRelativePath(directory, thumbFileName);

      return {
        fileName: relativeMain,
        url: buildPublicUrl(baseUrl, mainKey),
        storageType: "r2",
        size: main.info.size,
        width: main.info.width ?? null,
        height: main.info.height ?? null,
        thumbnailFileName: relativeThumb,
        thumbnailUrl: buildPublicUrl(baseUrl, thumbKey),
        thumbnailSize: thumb.info.size,
        thumbnailWidth: thumb.info.width ?? null,
        thumbnailHeight: thumb.info.height ?? null,
      };
    }

    await persistLocal(directory, mainFileName, thumbFileName, main, thumb);

    const relativeMain = toRelativePath(directory, mainFileName);
    const relativeThumb = toRelativePath(directory, thumbFileName);

    return {
      fileName: relativeMain,
      url: buildPublicPath(directory, mainFileName),
      storageType: "local",
      size: main.info.size,
      width: main.info.width ?? null,
      height: main.info.height ?? null,
      thumbnailFileName: relativeThumb,
      thumbnailUrl: buildPublicPath(directory, thumbFileName),
      thumbnailSize: thumb.info.size,
      thumbnailWidth: thumb.info.width ?? null,
      thumbnailHeight: thumb.info.height ?? null,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Gagal memproses berkas gambar.");
  }
}

export async function deleteMediaFile(storageType: string, fileName: string | null | undefined) {
  if (!fileName) {
    return;
  }

  const normalized = fileName.includes("/")
    ? fileName.replace(/^\/+/, "")
    : path.posix.join("uploads", fileName);

  if (storageType === "r2") {
    try {
      const config = ensureR2Config();
      const client = getR2Client(config);

      const keys = [normalized, buildThumbnailName(normalized)];
      await Promise.all(
        keys.map((key) =>
          client
            .send(
              new DeleteObjectCommand({
                Bucket: config.bucket,
                Key: key,
              })
            )
            .catch(() => {})
        )
      );
    } catch (error) {
      console.error("Gagal menghapus file dari R2", error);
    }
    return;
  }

  if (!storageType.startsWith("local")) {
    return;
  }

  const mainPath = path.join(process.cwd(), "public", normalized);
  const thumbPath = path.join(process.cwd(), "public", buildThumbnailName(normalized));

  await fs.unlink(mainPath).catch(() => {});
  await fs.unlink(thumbPath).catch(() => {});
}
