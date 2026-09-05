import { apiClient } from "./api";

import type {
  Product,
  ProductCreateRequest,
  ProductDetails,
  ProductUpdateRequest,
} from "../types/product";

export function getProducts(
  signal?: AbortSignal,
): Promise<Product[]> {
  return apiClient<Product[]>(
    "/products?limit=100&active_only=true",
    {
      signal,
    },
  );
}

export function getAdminProducts(
  signal?: AbortSignal,
): Promise<Product[]> {
  return apiClient<Product[]>(
    "/products?limit=100&active_only=false",
    {
      signal,
    },
  );
}

export function getProductBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<ProductDetails> {
  return apiClient<ProductDetails>(
    `/products/${slug}`,
    {
      signal,
    },
  );
}

export function updateProduct(
  productId: string,
  data: ProductUpdateRequest,
): Promise<ProductDetails> {
  return apiClient<ProductDetails>(
    `/products/${productId}`,
    {
      method: "PATCH",
      data,
    },
  );
}

export function deleteProduct(
  productId: string,
): Promise<void> {
  return apiClient<void>(
    `/products/${productId}`,
    {
      method: "DELETE",
    },
  );
}

export function createProduct(
  data: ProductCreateRequest,
): Promise<ProductDetails> {
  return apiClient<ProductDetails>(
    "/products",
    {
      method: "POST",
      data,
    },
  );
}

export async function getAdminProductById(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductDetails> {
  const products = await getAdminProducts(
    signal,
  );

  const selectedProduct = products.find(
    (product) => product.id === productId,
  );

  if (!selectedProduct) {
    throw new Error(
      "The selected product could not be found.",
    );
  }

  return getProductBySlug(
    selectedProduct.slug,
    signal,
  );
}

export async function getAdminProductDetails(
  signal?: AbortSignal,
): Promise<ProductDetails[]> {
  const products =
    await getAdminProducts(signal);

  return Promise.all(
    products.map((product) =>
      getProductBySlug(
        product.slug,
        signal,
      ),
    ),
  );
}