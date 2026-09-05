import { apiClient } from "./api";

import type {
  Product,
} from "../types/product";

const PRODUCTS_PER_REQUEST = 100;

export async function getAllActiveProducts(
  signal?: AbortSignal,
): Promise<Product[]> {
  const allProducts: Product[] = [];

  let offset = 0;

  while (true) {
    const currentProducts =
      await apiClient<Product[]>(
        `/products?offset=${offset}&limit=${PRODUCTS_PER_REQUEST}&active_only=true`,
        {
          signal,
        },
      );

    allProducts.push(
      ...currentProducts,
    );

    if (
      currentProducts.length <
      PRODUCTS_PER_REQUEST
    ) {
      return allProducts;
    }

    offset +=
      PRODUCTS_PER_REQUEST;
  }
}