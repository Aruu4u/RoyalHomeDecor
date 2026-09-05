import { supabase } from "../lib/supabase";

const PRODUCT_IMAGES_BUCKET =
  import.meta.env.VITE_PRODUCT_IMAGES_BUCKET ??
  "product-images";

export interface ProductImageUploadInput {
  localId: string;
  file: File;
}

export interface UploadedProductImage {
  localId: string;
  path: string;
  publicUrl: string;
}

function sanitizeFileName(
  fileName: string,
): string {
  const dotIndex =
    fileName.lastIndexOf(".");

  const nameWithoutExtension =
    dotIndex > 0
      ? fileName.slice(0, dotIndex)
      : fileName;

  const extension =
    dotIndex > 0
      ? fileName
          .slice(dotIndex)
          .toLowerCase()
      : "";

  const safeName =
    nameWithoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);

  return `${
    safeName || "product-image"
  }${extension}`;
}

export async function uploadProductImages(
  images: ProductImageUploadInput[],
): Promise<UploadedProductImage[]> {
  const uploadFolder =
    crypto.randomUUID();

  const uploadedImages:
    UploadedProductImage[] = [];

  try {
    for (
      let index = 0;
      index < images.length;
      index += 1
    ) {
      const image = images[index];

      const path = [
        "products",
        uploadFolder,
        `${String(index).padStart(
          2,
          "0",
        )}-${crypto.randomUUID()}-${sanitizeFileName(
          image.file.name,
        )}`,
      ].join("/");

      const { error } =
        await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(path, image.file, {
            cacheControl: "31536000",
            contentType: image.file.type,
            upsert: false,
          });

      if (error) {
        throw new Error(
          `Unable to upload ${image.file.name}: ${error.message}`,
        );
      }

      const { data } =
        supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .getPublicUrl(path);

      uploadedImages.push({
        localId: image.localId,
        path,
        publicUrl: data.publicUrl,
      });
    }

    return uploadedImages;
  } catch (error) {
    if (uploadedImages.length > 0) {
      await removeProductImages(
        uploadedImages.map(
          (image) => image.path,
        ),
      );
    }

    throw error;
  }
}

export async function removeProductImages(
  paths: string[],
): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  const { error } =
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove(paths);

  if (error) {
    console.error(
      "Unable to remove uploaded product images:",
      error.message,
    );
  }
}

export function getProductImageStoragePath(
  publicUrl: string,
): string | null {
  const marker =
    `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;

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