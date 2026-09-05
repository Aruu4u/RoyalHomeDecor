import { apiClient } from './api';
import type { Profile, ProfileCreateRequest, ProfileUpdateRequest } from '../types/profile';

export const profileService = {
  getProfile: () => apiClient<Profile>('/profile'),

  createProfile: (data: ProfileCreateRequest) =>
    apiClient<Profile>('/profile', { method: 'POST', data }),

  updateProfile: (data: ProfileUpdateRequest) =>
    apiClient<Profile>('/profile', { method: 'PATCH', data }),
};
