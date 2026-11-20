export type AvatarCropErrors = {
  canvasUnavailable: string;
  cropFailed: string;
};

/** Center-crop upload to a square WebP blob for Cloudinary avatar pipeline. */
export async function cropSquare(
  file: File,
  edge = 1024,
  errors?: AvatarCropErrors,
): Promise<Blob> {
  const canvasUnavailable = (errors?.canvasUnavailable || "").trim();
  const cropFailed = (errors?.cropFailed || "").trim();
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - size) / 2);
  const sy = Math.floor((bitmap.height - size) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(canvasUnavailable);
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, edge, edge);
  bitmap.close();
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(cropFailed))), "image/webp", 0.92);
  });
}
