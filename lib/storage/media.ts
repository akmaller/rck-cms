import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

type SaveResult = {
  fileName: string;
  url: string;
  storageType: "local";
};

const uploadsDir = path.join(process.cwd(), "public", "uploads");

function resolveExtension(file: File) {
  const originalName = file.name ?? "";
  const extFromName = path.extname(originalName);
  if (extFromName) {
    return extFromName.toLowerCase();
  }

  const mimeType = file.type ?? "";
  const subtype = mimeType.split("/")[1];
  if (subtype) {
    return `.${subtype.split("+")[0]}`;
  }

  return ".bin";
}

export async function saveMediaFile(file: File): Promise<SaveResult> {
  await fs.mkdir(uploadsDir, { recursive: true });

  const extension = resolveExtension(file);
  const uniqueName = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(uploadsDir, uniqueName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return {
    fileName: uniqueName,
    url: `/uploads/${uniqueName}`,
    storageType: "local",
  };
}

export async function deleteMediaFile(storageType: string, fileName: string | null | undefined) {
  if (storageType !== "local" || !fileName) {
    return;
  }

  const filePath = path.join(uploadsDir, fileName);
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore missing files
  }
}
