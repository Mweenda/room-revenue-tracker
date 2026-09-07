const TARGET_BYTES = 1_000_000;
const MAX_DIMENSION = 1920;
const MAX_BYTES = 5_000_000;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export function fileExtension(file: { name?: string; type?: string }): string {
  const fromName = file.name?.split(".").pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  const mime = (file.type ?? "").toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
}

export function contentTypeFor(file: { name?: string; type?: string }): string {
  const declared = (file.type ?? "").trim().toLowerCase();
  if (declared && declared !== "application/octet-stream") return declared;
  return MIME_BY_EXT[fileExtension(file)] ?? "image/jpeg";
}

export function storageObjectPath(tenantId: string, category: string, file: { name?: string; type?: string }): string {
  const ext = fileExtension(file);
  return `${tenantId}/${category}-${Date.now()}.${ext}`;
}

export function describeStorageError(error: { message?: string; statusCode?: string | number } | null | undefined): string {
  const message = error?.message ?? "";
  const code = String(error?.statusCode ?? "");
  const blob = `${code} ${message}`.toLowerCase();

  if (blob.includes("413") || blob.includes("too large") || blob.includes("maximum") || blob.includes("payload")) {
    return "Image is too large. Please choose a smaller file.";
  }
  if (blob.includes("403") || blob.includes("row-level security") || blob.includes("not allowed") || blob.includes("unauthorized")) {
    return "Upload was denied. Sign out, sign back in, and try the image again.";
  }
  if (blob.includes("bucket") && blob.includes("not found")) {
    return "The receipt storage bucket is missing. Contact your landlord.";
  }
  if (blob.includes("mime") || blob.includes("not supported") || blob.includes("invalid")) {
    return "That file type is not supported. Please upload a JPEG, PNG, or PDF.";
  }
  return message.trim() || "Could not upload the file. Please try a JPEG or PNG under 5MB.";
}

function isBrowserImage(file: File): boolean {
  return file.type.startsWith("image/") && typeof document !== "undefined";
}

export async function prepareUploadFile(file: File): Promise<File> {
  if (!isBrowserImage(file) || file.size <= TARGET_BYTES) return file;

  try {
    const compressed = await compressImage(file);
    if (compressed.size <= MAX_BYTES) return compressed;
  } catch {
    // Fall through and try the original; the storage API will reject if it is still too big.
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large. Please choose a smaller file.");
  }
  return file;
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.8);
  });
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg") || "receipt.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
