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

const uploadsDir = path.join(process.cwd(), "public", "uploads");

function buildThumbnailName(fileName: string) {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, ext.length ? -ext.length : undefined);
  return `${base}-thumb${ext}`;
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

export async function saveMediaFile(file: File): Promise<SaveResult> {
  await fs.mkdir(uploadsDir, { recursive: true });

  const uniqueBase = `${Date.now()}-${randomUUID()}`;
  const extension = ".webp";
  const mainFileName = `${uniqueBase}${extension}`;
  const thumbFileName = buildThumbnailName(mainFileName);

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const mainResult = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  await fs.writeFile(path.join(uploadsDir, mainFileName), mainResult.data);

  const thumbResult = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 720, height: 360, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  await fs.writeFile(path.join(uploadsDir, thumbFileName), thumbResult.data);

  return {
    fileName: mainFileName,
    url: `/uploads/${mainFileName}`,
    storageType: "local",
    size: mainResult.info.size,
    width: mainResult.info.width ?? null,
    height: mainResult.info.height ?? null,
    thumbnailFileName: thumbFileName,
    thumbnailUrl: `/uploads/${thumbFileName}`,
    thumbnailSize: thumbResult.info.size,
    thumbnailWidth: thumbResult.info.width ?? null,
    thumbnailHeight: thumbResult.info.height ?? null,
  };
}

export async function deleteMediaFile(storageType: string, fileName: string | null | undefined) {
  if (storageType !== "local" || !fileName) {
    return;
  }

  const mainPath = path.join(uploadsDir, fileName);
  const thumbPath = path.join(uploadsDir, buildThumbnailName(fileName));

  await fs.unlink(mainPath).catch(() => {});
  await fs.unlink(thumbPath).catch(() => {});
}
