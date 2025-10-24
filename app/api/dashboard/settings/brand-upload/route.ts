import { NextRequest, NextResponse } from "next/server";

import { assertRole } from "@/lib/auth/permissions";
import { saveMediaFile } from "@/lib/storage/media";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  await assertRole(["EDITOR", "ADMIN"]);

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Form data tidak valid" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File gambar wajib diunggah" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Hanya format gambar yang didukung" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 2MB" }, { status: 400 });
  }

  const saved = await saveMediaFile(file);

  return NextResponse.json({
    data: {
      url: saved.url,
      thumbnailUrl: saved.thumbnailUrl,
      fileName: saved.fileName,
      storageType: saved.storageType,
    },
  });
}
