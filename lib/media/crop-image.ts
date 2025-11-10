import type { Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = src;
  });
}

type CropImageOptions = {
  imageSrc: string;
  cropArea: Area;
  fileName: string;
  mimeType: string;
};

export async function getCroppedImage({
  imageSrc,
  cropArea,
  fileName,
  mimeType,
}: CropImageOptions): Promise<File> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropArea.width));
  canvas.height = Math.max(1, Math.round(cropArea.height));
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Kanvas tidak mendukung 2D context.");
  }

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height,
  );

  const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
  const outputType = supportedTypes.includes(mimeType) ? mimeType : "image/jpeg";
  const extension = (() => {
    if (outputType === "image/jpeg") return "jpg";
    if (outputType === "image/png") return "png";
    if (outputType === "image/webp") return "webp";
    return "jpg";
  })();
  const baseName = fileName.replace(/\.[^.]+$/, "") || "image";
  const croppedFileName = `${baseName}-cropped.${extension}`;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Gagal membuat blob hasil crop."));
        }
      },
      outputType,
      outputType === "image/jpeg" || outputType === "image/webp" ? 0.92 : undefined,
    );
  });

  return new File([blob], croppedFileName, { type: blob.type });
}
