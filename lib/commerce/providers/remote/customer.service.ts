import type { Address, Customer, CustomerService, Order } from "@/lib/commerce/types";
import { fetchJson } from "./http";

/**
 * Browser-side CustomerService. Every method is session-gated server-side
 * (see app/api/customer/*) — the customerId params below exist only for
 * interface-shape parity; identity is always resolved from the httpOnly
 * session cookie the browser sends automatically, not from anything passed here.
 */
export function createRemoteCustomerService(): CustomerService {
  return {
    async getCustomer(customerId) {
      const { customer } = await fetchJson<{ customer: Customer | null }>(
        `/api/customer?customerId=${encodeURIComponent(customerId)}`
      );
      return customer;
    },

    async updateProfile(customerId, patch) {
      return (
        await fetchJson<{ customer: Customer }>("/api/customer", {
          method: "PATCH",
          body: JSON.stringify({ customerId, ...patch }),
        })
      ).customer;
    },

    async addAddress(_customerId, address: Address) {
      return (await fetchJson<{ customer: Customer }>("/api/customer/addresses", { method: "POST", body: JSON.stringify(address) }))
        .customer;
    },

    async updateAddress(_customerId, addressId, address: Address) {
      return (
        await fetchJson<{ customer: Customer }>(`/api/customer/addresses/${addressId}`, {
          method: "PATCH",
          body: JSON.stringify(address),
        })
      ).customer;
    },

    async removeAddress(_customerId, addressId) {
      return (await fetchJson<{ customer: Customer }>(`/api/customer/addresses/${addressId}`, { method: "DELETE" })).customer;
    },

    async getOrders(customerId) {
      return (await fetchJson<{ orders: Order[] }>(`/api/customer/orders?customerId=${encodeURIComponent(customerId)}`)).orders;
    },
  };
}
