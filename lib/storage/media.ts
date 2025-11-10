import { randomUUID } from "crypto";
import { promises as fs, existsSync } from "fs";
import path from "path";
import os from "os";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import type { FfprobeData } from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

type StorageDriver = "local" | "r2";

type SaveResult = {
  fileName: string;
  url: string;
  storageType: StorageDriver;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
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
  __ffmpegConfigured?: boolean;
};

function getNodeRequire(): NodeJS.Require | null {
  try {
    const fn = Function("return typeof require !== 'undefined' ? require : undefined;");
    const req = fn() as NodeJS.Require | undefined;
    return req ?? null;
  } catch {
    return null;
  }
}

function normalizeCandidatePath(candidate: string | null | undefined) {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveBinaryPath(rawCandidate: string | null | undefined, moduleId: string, envVarName?: string) {
  const candidates: string[] = [];
  const normalized = normalizeCandidatePath(rawCandidate);
  if (normalized) {
    candidates.push(normalized);
  }
  if (envVarName) {
    const fromEnv = normalizeCandidatePath(process.env[envVarName]);
    if (fromEnv) {
      candidates.push(fromEnv);
    }
  }
  const requireFn = getNodeRequire();
  if (requireFn) {
    try {
      const resolvedModule = requireFn(moduleId) as unknown;
      if (typeof resolvedModule === "string") {
        candidates.push(resolvedModule);
      } else if (
        resolvedModule &&
        typeof resolvedModule === "object" &&
        "path" in resolvedModule &&
        typeof (resolvedModule as { path?: string }).path === "string"
      ) {
        candidates.push((resolvedModule as { path: string }).path);
      }
    } catch {
      // ignore
    }
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return normalized ?? null;
}

function parseStorageDriver(value: string | null | undefined): StorageDriver | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "r2") return "r2";
  if (normalized === "local") return "local";
  return null;
}

function resolveStorageDriver(): StorageDriver {
  return parseStorageDriver(process.env.STORAGE_DRIVER) ?? "local";
}

const STORAGE_DRIVER = resolveStorageDriver();

function resolveMediaStorageDriver(kind: "image" | "video"): StorageDriver {
  const override =
    kind === "image"
      ? parseStorageDriver(process.env.MEDIA_STORAGE_IMAGE_DRIVER)
      : parseStorageDriver(process.env.MEDIA_STORAGE_VIDEO_DRIVER);
  return override ?? STORAGE_DRIVER;
}

function buildThumbnailName(fileName: string, options?: { extension?: string }) {
  const ext = path.extname(fileName);
  const base = ext.length ? fileName.slice(0, -ext.length) : fileName;
  const targetExt = options?.extension ?? ext;
  return `${base}-thumb${targetExt}`;
}

function resolveBaseDirectory(directory: string) {
  return path.join(process.cwd(), "public", directory);
}

function normalizeDirectory(directory?: string) {
  const raw = directory?.trim() ?? "";
  const sanitized = raw.replace(/^\/+|\/+$/g, "");
  return sanitized.length > 0 ? sanitized : "uploads";
}

function normalizeStoredFileName(fileName: string | null | undefined) {
  if (!fileName) {
    return null;
  }
  const trimmed = fileName.replace(/^\/+/, "");
  return trimmed.includes("/") ? trimmed : path.posix.join("uploads", trimmed);
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

function ensureFfmpegConfigured() {
  if (globalScope.__ffmpegConfigured) {
    return;
  }
  const rawFfmpegPath =
    typeof ffmpegStatic === "string"
      ? ffmpegStatic
      : (ffmpegStatic as unknown as { path?: string } | undefined)?.path ?? null;
  const rawFfprobePath =
    typeof ffprobeStatic === "string"
      ? ffprobeStatic
      : (ffprobeStatic as { path?: string } | undefined)?.path ?? null;

  const resolvedFfmpegPath = resolveBinaryPath(rawFfmpegPath, "ffmpeg-static", "FFMPEG_PATH");
  if (resolvedFfmpegPath) {
    ffmpeg.setFfmpegPath(resolvedFfmpegPath);
    if (!process.env.FFMPEG_PATH) {
      process.env.FFMPEG_PATH = resolvedFfmpegPath;
    }
  }

  const resolvedFfprobePath = resolveBinaryPath(rawFfprobePath, "ffprobe-static", "FFPROBE_PATH");
  if (resolvedFfprobePath) {
    ffmpeg.setFfprobePath(resolvedFfprobePath);
    if (!process.env.FFPROBE_PATH) {
      process.env.FFPROBE_PATH = resolvedFfprobePath;
    }
  }

  globalScope.__ffmpegConfigured = true;
}

function inferVideoExtension(file: File) {
  const byName = file.name ? path.extname(file.name) : "";
  if (byName) {
    return byName.startsWith(".") ? byName.toLowerCase() : `.${byName.toLowerCase()}`;
  }
  switch (file.type) {
    case "video/webm":
      return ".webm";
    case "video/ogg":
    case "video/ogv":
      return ".ogv";
    case "video/quicktime":
      return ".mov";
    default:
      return ".mp4";
  }
}

async function probeVideoMetadata(inputPath: string): Promise<{
  width: number | null;
  height: number | null;
  duration: number | null;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (error: Error | null, data: FfprobeData) => {
      if (error) {
        reject(error);
        return;
      }
      const videoStream = data.streams?.find((stream) => stream.codec_type === "video");
      const rawDuration = data.format?.duration ?? null;
      let duration: number | null = null;
      if (typeof rawDuration === "number" && Number.isFinite(rawDuration)) {
        duration = rawDuration;
      } else if (typeof rawDuration === "string") {
        const parsed = Number.parseFloat(rawDuration);
        duration = Number.isFinite(parsed) ? parsed : null;
      }
      resolve({
        width: videoStream?.width ?? null,
        height: videoStream?.height ?? null,
        duration,
      });
    });
  });
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

async function generateVideoPoster(inputPath: string) {
  const posterFileName = `${path.basename(inputPath)}-poster.png`;
  const folder = path.dirname(inputPath);
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .screenshots({
        timestamps: ["0"],
        filename: posterFileName,
        folder,
        size: "1280x?",
      });
  });

  const posterPath = path.join(folder, posterFileName);
  const buffer = await fs.readFile(posterPath);
  await fs.unlink(posterPath).catch(() => {});

  const poster = (await sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true })) as ProcessedImage;

  return poster;
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
  if (file.type.startsWith("video/")) {
    return saveVideoVariant(file, options);
  }
  if (file.type.startsWith("image/")) {
    return saveImageVariant(file, options);
  }
  throw new Error("Jenis media tidak didukung.");
}

async function saveImageVariant(file: File, options?: SaveMediaOptions): Promise<SaveResult> {
  const driver = resolveMediaStorageDriver("image");
  const directory = normalizeDirectory(options?.directory);
  const uniqueBase = `${Date.now()}-${randomUUID()}`;
  const extension = ".webp";
  const mainFileName = `${uniqueBase}${extension}`;
  const thumbFileName = buildThumbnailName(mainFileName);

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const { main, thumb } = await processImageVariants(inputBuffer);

    if (driver === "r2") {
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
        duration: null,
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
      storageType: driver,
      size: main.info.size,
      width: main.info.width ?? null,
      height: main.info.height ?? null,
      duration: null,
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

async function saveVideoVariant(file: File, options?: SaveMediaOptions): Promise<SaveResult> {
  ensureFfmpegConfigured();
  const driver = resolveMediaStorageDriver("video");
  const directory = normalizeDirectory(options?.directory);
  const uniqueBase = `${Date.now()}-${randomUUID()}`;
  const extension = inferVideoExtension(file);
  const mainFileName = `${uniqueBase}${extension}`;
  const thumbFileName = buildThumbnailName(mainFileName, { extension: ".webp" });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rcms-media-"));
  const tempVideoPath = path.join(tempDir, `source${extension}`);

  try {
    const videoBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempVideoPath, videoBuffer);

    const metadata = await probeVideoMetadata(tempVideoPath).catch(() => ({
      width: null,
      height: null,
      duration: null,
    }));
    const poster = await generateVideoPoster(tempVideoPath);

    if (driver === "r2") {
      const config = ensureR2Config();
      const client = getR2Client(config);

      const mainKey = deriveObjectKey(directory, mainFileName);
      const thumbKey = deriveObjectKey(directory, thumbFileName);

      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: mainKey,
            Body: videoBuffer,
            ContentType: file.type || "video/mp4",
          })
        );

        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: thumbKey,
            Body: poster.data,
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

      const relativeMain = toRelativePath(directory, mainFileName);
      const relativeThumb = toRelativePath(directory, thumbFileName);

      return {
        fileName: relativeMain,
        url: buildPublicUrl(config.baseUrl, mainKey),
        storageType: "r2",
        size: videoBuffer.length,
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        thumbnailFileName: relativeThumb,
        thumbnailUrl: buildPublicUrl(config.baseUrl, thumbKey),
        thumbnailSize: poster.info.size,
        thumbnailWidth: poster.info.width ?? null,
        thumbnailHeight: poster.info.height ?? null,
      };
    }

    const baseDir = resolveBaseDirectory(directory);
    await fs.mkdir(baseDir, { recursive: true });

    const mainPath = path.join(baseDir, mainFileName);
    const thumbPath = path.join(baseDir, thumbFileName);

    try {
      await fs.writeFile(mainPath, videoBuffer);
      await fs.writeFile(thumbPath, poster.data);
    } catch (error) {
      await fs.unlink(mainPath).catch(() => {});
      await fs.unlink(thumbPath).catch(() => {});
      throw error;
    }

    const relativeMain = toRelativePath(directory, mainFileName);
    const relativeThumb = toRelativePath(directory, thumbFileName);

    return {
      fileName: relativeMain,
      url: buildPublicPath(directory, mainFileName),
      storageType: driver,
      size: videoBuffer.length,
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      thumbnailFileName: relativeThumb,
      thumbnailUrl: buildPublicPath(directory, thumbFileName),
      thumbnailSize: poster.info.size,
      thumbnailWidth: poster.info.width ?? null,
      thumbnailHeight: poster.info.height ?? null,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Gagal memproses berkas video.");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function deleteMediaFile(
  storageType: string,
  fileName: string | null | undefined,
  thumbnailFileName?: string | null | undefined
) {
  if (!fileName) {
    return;
  }

  const normalized = normalizeStoredFileName(fileName);
  if (!normalized) {
    return;
  }
  const normalizedThumb = normalizeStoredFileName(thumbnailFileName ?? null);

  if (storageType === "r2") {
    try {
      const config = ensureR2Config();
      const client = getR2Client(config);

      const keys = [normalized];
      if (normalizedThumb) {
        keys.push(normalizedThumb);
      }
      const fallbackThumb = buildThumbnailName(normalized, { extension: ".webp" });
      if (!keys.includes(fallbackThumb)) {
        keys.push(fallbackThumb);
      }

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
  const thumbCandidates = [
    normalizedThumb,
    buildThumbnailName(normalized),
    buildThumbnailName(normalized, { extension: ".webp" }),
  ]
    .filter(Boolean)
    .map((value) => path.join(process.cwd(), "public", value as string));

  await fs.unlink(mainPath).catch(() => {});
  await Promise.all(
    thumbCandidates.map((thumbPath) => fs.unlink(thumbPath).catch(() => {}))
  );
}
