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
  cropPercent?: Area;
  fileName: string;
  mimeType: string;
};

export async function getCroppedImage({
  imageSrc,
  cropArea,
  cropPercent,
  fileName,
  mimeType,
}: CropImageOptions): Promise<File> {
  const image = await loadImage(imageSrc);

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  const resolvedCrop = (() => {
    if (!cropPercent) {
      return {
        x: cropArea.x,
        y: cropArea.y,
        width: cropArea.width,
        height: cropArea.height,
      };
    }
    return {
      x: (cropPercent.x / 100) * naturalWidth,
      y: (cropPercent.y / 100) * naturalHeight,
      width: (cropPercent.width / 100) * naturalWidth,
      height: (cropPercent.height / 100) * naturalHeight,
    };
  })();

  const boundedCrop = {
    x: Math.max(0, Math.min(resolvedCrop.x, naturalWidth)),
    y: Math.max(0, Math.min(resolvedCrop.y, naturalHeight)),
    width: Math.max(1, Math.min(resolvedCrop.width, naturalWidth)),
    height: Math.max(1, Math.min(resolvedCrop.height, naturalHeight)),
  };

  const targetWidth = Math.min(naturalWidth, 1920);
  const scale = targetWidth / boundedCrop.width;
  const outputWidth = Math.max(1, Math.round(boundedCrop.width * scale));
  const outputHeight = Math.max(1, Math.round(boundedCrop.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Kanvas tidak mendukung 2D context.");
  }

  context.drawImage(
    image,
    boundedCrop.x,
    boundedCrop.y,
    boundedCrop.width,
    boundedCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
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
