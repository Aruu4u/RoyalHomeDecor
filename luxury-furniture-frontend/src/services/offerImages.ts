import { supabase } from "../lib/supabase";

/*
 * Offer section background images live in the same Supabase bucket as
 * product and collection artwork, under their own prefix.
 */
const OFFER_IMAGES_BUCKET =
  import.meta.env.VITE_PRODUCT_IMAGES_BUCKET ?? "product-images";

const OFFER_IMAGE_PREFIX = "offers";

export const MAX_OFFER_IMAGE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export interface UploadedOfferImage {
  path: string;
  publicUrl: string;
}

/** Makes a filename safe for a storage key while keeping its extension. */
function sanitiseFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");

  const extension =
    dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : "";

  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;

  const safeStem = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${safeStem || "offer-image"}${extension}`;
}

/** Human-readable reason a file cannot be used, or null when it is fine. */
export function validateOfferImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Use a JPG, PNG, WebP or AVIF image.";
  }

  if (file.size > MAX_OFFER_IMAGE_BYTES) {
    const limitMb = Math.round(MAX_OFFER_IMAGE_BYTES / (1024 * 1024));

    return `That image is larger than ${limitMb} MB. Please compress it first.`;
  }

  return null;
}

/**
 * Uploads a background image and returns its public URL.
 *
 * A random path segment avoids collisions and makes the URL effectively
 * immutable, which is what allows the long cache lifetime.
 */
export async function uploadOfferBackgroundImage(
  file: File,
): Promise<UploadedOfferImage> {
  const validationError = validateOfferImage(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const path = [
    OFFER_IMAGE_PREFIX,
    crypto.randomUUID(),
    `${crypto.randomUUID()}-${sanitiseFileName(file.name)}`,
  ].join("/");

  const { error } = await supabase.storage
    .from(OFFER_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Unable to upload ${file.name}: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(OFFER_IMAGES_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}

/** Extracts the storage key from a public URL, if it is one of ours. */
function getStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${OFFER_IMAGES_BUCKET}/`;

  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const encodedPath = publicUrl.slice(markerIndex + marker.length);

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

/**
 * Deletes a previously uploaded background.
 *
 * Failure is logged rather than thrown: an orphaned file in storage is a
 * far smaller problem than blocking the administrator's edit.
 */
export async function removeOfferBackgroundImage(
  publicUrl: string,
): Promise<void> {
  const path = getStoragePath(publicUrl);

  if (!path) {
    return;
  }

  const { error } = await supabase.storage
    .from(OFFER_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    console.error("Unable to remove offer image:", error.message);
  }
}
