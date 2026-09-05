import { apiClient } from "./api";

import type {
  Inventory,
  InventoryUpdateRequest,
  ProductImage,
  ProductImageCreateRequest,
  ProductImageUpdateRequest,
  ProductVariant,
  ProductVariantCreateRequest,
  ProductVariantUpdateRequest,
} from "../types/product";

export function addProductImage(
  productId: string,
  data: ProductImageCreateRequest,
): Promise<ProductImage> {
  return apiClient<ProductImage>(
    `/products/${productId}/images`,
    {
      method: "POST",
      data,
    },
  );
}

export function updateProductImage(
  imageId: string,
  data: ProductImageUpdateRequest,
): Promise<ProductImage> {
  return apiClient<ProductImage>(
    `/product-images/${imageId}`,
    {
      method: "PATCH",
      data,
    },
  );
}

export function deleteProductImage(
  imageId: string,
): Promise<void> {
  return apiClient<void>(
    `/product-images/${imageId}`,
    {
      method: "DELETE",
    },
  );
}

export function addProductVariant(
  productId: string,
  data: ProductVariantCreateRequest,
): Promise<ProductVariant> {
  return apiClient<ProductVariant>(
    `/products/${productId}/variants`,
    {
      method: "POST",
      data,
    },
  );
}

export function updateProductVariant(
  variantId: string,
  data: ProductVariantUpdateRequest,
): Promise<ProductVariant> {
  return apiClient<ProductVariant>(
    `/product-variants/${variantId}`,
    {
      method: "PATCH",
      data,
    },
  );
}

export function deleteProductVariant(
  variantId: string,
): Promise<void> {
  return apiClient<void>(
    `/product-variants/${variantId}`,
    {
      method: "DELETE",
    },
  );
}

export function updateVariantInventory(
  variantId: string,
  data: InventoryUpdateRequest,
): Promise<Inventory> {
  return apiClient<Inventory>(
    `/inventory/${variantId}`,
    {
      method: "PATCH",
      data,
    },
  );
}