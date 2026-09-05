import { apiClient } from "./api";

import type {
  Collection,
  CollectionCreateRequest,
  CollectionUpdateRequest,
} from "../types/collection";

export function getCollections(
  signal?: AbortSignal,
): Promise<Collection[]> {
  return apiClient<Collection[]>(
    "/collections",
    {
      signal,
    },
  );
}

export function getAdminCollections(
  signal?: AbortSignal,
): Promise<Collection[]> {
  return apiClient<Collection[]>(
    "/collections?limit=100&active_only=false",
    {
      signal,
    },
  );
}

export function createCollection(
  data: CollectionCreateRequest,
): Promise<Collection> {
  return apiClient<Collection>(
    "/collections",
    {
      method: "POST",
      data,
    },
  );
}

export function updateCollection(
  collectionId: string,
  data: CollectionUpdateRequest,
): Promise<Collection> {
  return apiClient<Collection>(
    `/collections/${collectionId}`,
    {
      method: "PATCH",
      data,
    },
  );
}

export function deleteCollection(
  collectionId: string,
): Promise<void> {
  return apiClient<void>(
    `/collections/${collectionId}`,
    {
      method: "DELETE",
    },
  );
}