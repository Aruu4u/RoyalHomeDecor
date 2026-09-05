/*
 * Mirrors app/schemas/profile.py.
 *
 * `phone` is optional and nullable on the backend (`str | None`), on the
 * response as well as on both request bodies, so it is typed that way
 * here. The response has no `email` field: that lives on the Supabase
 * session, not on the profile row.
 */

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileCreateRequest {
  full_name: string;
  phone?: string | null;
}

export interface ProfileUpdateRequest {
  full_name?: string | null;
  phone?: string | null;
}
