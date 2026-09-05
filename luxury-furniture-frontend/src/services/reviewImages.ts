import { supabase } from "../lib/supabase";

/*
 * Customer review photographs share the product-images bucket under their
 * own prefix, so there is one storage configuration to manage rather than
 * two.
 */
const REVIEW_IMAGES_BUCKET =
  import.meta.env.VITE_PRODUCT_IMAGES_BUCKET ?? "product-images";

const REVIEW_IMAGE_PREFIX = "reviews";

/*
 * Smaller than the 5 MB allowed for shop artwork. These come straight off
 * a phone, several at a time, on whatever connection the customer has.
 */
export const MAX_REVIEW_IMAGE_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_REVIEW_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  /* Straight from an iPhone camera roll. */
  "image/heic",
  "image/heif",
];

/** Human-readable reason a file cannot be used, or null when it is fine. */
export function validateReviewImage(file: File): string | null {
  if (!ACCEPTED_REVIEW_IMAGE_TYPES.includes(file.type)) {
    return "Please choose a photo (JPG, PNG, WebP or HEIC).";
  }

  if (file.size > MAX_REVIEW_IMAGE_BYTES) {
    const limitMb = Math.round(MAX_REVIEW_IMAGE_BYTES / (1024 * 1024));

    return `That photo is larger than ${limitMb} MB. Please choose a smaller one.`;
  }

  return null;
}

/** Keeps the extension, drops everything else that could break a key. */
function safeExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return "";
  }

  const extension = fileName.slice(dotIndex).toLowerCase();

  return /^\.[a-z0-9]{2,5}$/.test(extension) ? extension : "";
}

/**
 * Uploads one review photograph and returns its public URL.
 *
 * The original filename is discarded rather than sanitised. Camera and
 * messaging apps put dates, locations and sometimes names into filenames,
 * and none of that belongs in a public URL attached to a review.
 */
export async function uploadReviewPhoto(file: File): Promise<string> {
  const validationError = validateReviewImage(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const path = [
    REVIEW_IMAGE_PREFIX,
    `${crypto.randomUUID()}${safeExtension(file.name)}`,
  ].join("/");

  const { error } = await supabase.storage
    .from(REVIEW_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Unable to upload that photo: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(REVIEW_IMAGES_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
