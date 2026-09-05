export interface Collection {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  hero_image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CollectionCreateRequest {
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  hero_image_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface CollectionUpdateRequest {
  name?: string;
  slug?: string;
  short_description?: string | null;
  description?: string | null;
  hero_image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}