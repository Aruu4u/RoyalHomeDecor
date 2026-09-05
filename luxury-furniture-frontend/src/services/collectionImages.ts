import { supabase } from "../lib/supabase";

const COLLECTION_IMAGES_BUCKET =
  import.meta.env.VITE_PRODUCT_IMAGES_BUCKET ??
  "product-images";

export interface UploadedCollectionImage {
  path: string;
  publicUrl: string;
}

function sanitizeFileName(
  fileName: string,
): string {
  const dotIndex =
    fileName.lastIndexOf(".");

  const extension =
    dotIndex > 0
      ? fileName
          .slice(dotIndex)
          .toLowerCase()
      : "";

  const nameWithoutExtension =
    dotIndex > 0
      ? fileName.slice(0, dotIndex)
      : fileName;

  const safeName =
    nameWithoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);

  return `${
    safeName || "collection-image"
  }${extension}`;
}

function getStoragePath(
  publicUrl: string,
): string | null {
  const marker =
    `/storage/v1/object/public/${COLLECTION_IMAGES_BUCKET}/`;

  const markerIndex =
    publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const encodedPath =
    publicUrl.slice(
      markerIndex + marker.length,
    );

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

export async function uploadCollectionHeroImage(
  file: File,
): Promise<UploadedCollectionImage> {
  const path = [
    "collections",
    crypto.randomUUID(),
    `${crypto.randomUUID()}-${sanitizeFileName(
      file.name,
    )}`,
  ].join("/");

  const { error } =
    await supabase.storage
      .from(COLLECTION_IMAGES_BUCKET)
      .upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

  if (error) {
    throw new Error(
      `Unable to upload ${file.name}: ${error.message}`,
    );
  }

  const { data } =
    supabase.storage
      .from(COLLECTION_IMAGES_BUCKET)
      .getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function removeCollectionHeroImage(
  publicUrl: string,
): Promise<void> {
  const path =
    getStoragePath(publicUrl);

  if (!path) {
    return;
  }

  const { error } =
    await supabase.storage
      .from(COLLECTION_IMAGES_BUCKET)
      .remove([path]);

  if (error) {
    console.error(
      "Unable to remove collection image:",
      error.message,
    );
  }
}