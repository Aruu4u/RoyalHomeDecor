import { apiClient } from "./api";
import type {
  Address,
  AddressCreateRequest,
  AddressUpdateRequest,
} from "../types/address";

export const addressService = {
  listAddresses(
    signal?: AbortSignal,
  ): Promise<Address[]> {
    return apiClient<Address[]>("/addresses", {
      signal,
    });
  },

  createAddress(
    data: AddressCreateRequest,
  ): Promise<Address> {
    return apiClient<Address>("/addresses", {
      method: "POST",
      data,
    });
  },

  updateAddress(
    addressId: string,
    data: AddressUpdateRequest,
  ): Promise<Address> {
    return apiClient<Address>(
      `/addresses/${addressId}`,
      {
        method: "PATCH",
        data,
      },
    );
  },

  deleteAddress(addressId: string): Promise<void> {
    return apiClient<void>(
      `/addresses/${addressId}`,
      {
        method: "DELETE",
      },
    );
  },
};