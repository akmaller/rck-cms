import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

type SaveResult = {
  fileName: string;
  url: string;
  storageType: "local";
  size: number;
  width: number | null;
  height: number | null;
  thumbnailFileName: string;
  thumbnailUrl: string;
  thumbnailSize: number;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
};

function buildThumbnailName(fileName: string) {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, ext.length ? -ext.length : undefined);
  return `${base}-thumb${ext}`;
}

function resolveBaseDirectory(directory: string) {
  return path.join(process.cwd(), "public", directory);
}

function toRelativePath(directory: string, fileName: string) {
  if (directory === "uploads") {
    return fileName;
  }
  return path.posix.join(directory.replace(/^\/+|\/+$/g, ""), fileName);
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

type SaveMediaOptions = {
  directory?: string;
};

export async function saveMediaFile(file: File, options?: SaveMediaOptions): Promise<SaveResult> {
  const directory = (options?.directory ?? "uploads").replace(/^\/+|\/+$/g, "") || "uploads";
  const baseDir = resolveBaseDirectory(directory);

  await fs.mkdir(baseDir, { recursive: true });

  const uniqueBase = `${Date.now()}-${randomUUID()}`;
  const extension = ".webp";
  const mainFileName = `${uniqueBase}${extension}`;
  const thumbFileName = buildThumbnailName(mainFileName);
  const mainPath = path.join(baseDir, mainFileName);
  const thumbPath = path.join(baseDir, thumbFileName);

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const mainResult = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(mainPath, mainResult.data);

    const thumbResult = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 720, height: 360, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(thumbPath, thumbResult.data);

    const relativeMain = toRelativePath(directory, mainFileName);
    const relativeThumb = toRelativePath(directory, thumbFileName);

    return {
      fileName: relativeMain,
      url: `/${directory}/${mainFileName}`,
      storageType: "local",
      size: mainResult.info.size,
      width: mainResult.info.width ?? null,
      height: mainResult.info.height ?? null,
      thumbnailFileName: relativeThumb,
      thumbnailUrl: `/${directory}/${thumbFileName}`,
      thumbnailSize: thumbResult.info.size,
      thumbnailWidth: thumbResult.info.width ?? null,
      thumbnailHeight: thumbResult.info.height ?? null,
    };
  } catch {
    await fs.unlink(mainPath).catch(() => {});
    await fs.unlink(thumbPath).catch(() => {});
    throw new Error("Gagal memproses berkas gambar.");
  }
}

export async function deleteMediaFile(storageType: string, fileName: string | null | undefined) {
  if (!storageType.startsWith("local") || !fileName) {
    return;
  }

  const relativePath = fileName.includes("/")
    ? fileName.replace(/^\/+/, "")
    : path.posix.join("uploads", fileName);

  const mainPath = path.join(process.cwd(), "public", relativePath);
  const thumbPath = path.join(
    process.cwd(),
    "public",
    buildThumbnailName(relativePath)
  );

  await fs.unlink(mainPath).catch(() => {});
  await fs.unlink(thumbPath).catch(() => {});
}
