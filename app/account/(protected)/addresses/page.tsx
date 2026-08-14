"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCommerceProvider } from "@/lib/commerce";
import { AddressForm } from "@/components/account/AddressForm";
import { useToast } from "@/components/providers/ToastProvider";
import type { AddressFormValues } from "@/lib/validation/checkout";

type EditState = { mode: "add" } | { mode: "edit"; addressId: string } | null;

export default function AccountAddressesPage() {
  const { customer, refreshCustomer } = useAuth();
  const { toast } = useToast();
  const [editState, setEditState] = useState<EditState>(null);

  if (!customer) return null;

  const commerce = getCommerceProvider();

  const handleAdd = async (values: AddressFormValues) => {
    await commerce.customer.addAddress(customer.id, values);
    await refreshCustomer();
    setEditState(null);
    toast({ title: "Address added", tone: "success" });
  };

  const handleUpdate = async (addressId: string, values: AddressFormValues) => {
    await commerce.customer.updateAddress(customer.id, addressId, values);
    await refreshCustomer();
    setEditState(null);
    toast({ title: "Address updated", tone: "success" });
  };

  const handleRemove = async (addressId: string) => {
    await commerce.customer.removeAddress(customer.id, addressId);
    await refreshCustomer();
    toast({ title: "Address removed" });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">Addresses</h1>
        {editState === null ? (
          <button
            type="button"
            onClick={() => setEditState({ mode: "add" })}
            className="flex items-center gap-1.5 text-sm underline underline-offset-4 hover:text-luxe-black"
          >
            <Plus className="size-4" strokeWidth={1.5} />
            Add address
          </button>
        ) : null}
      </div>

      {editState?.mode === "add" ? (
        <div className="mt-6">
          <AddressForm onSubmit={handleAdd} onCancel={() => setEditState(null)} submitLabel="Add Address" />
        </div>
      ) : null}

      {customer.addresses.length === 0 && editState === null ? (
        <p className="mt-8 text-sm text-luxe-gray-dark">You haven&apos;t saved any addresses yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {customer.addresses.map((address) =>
            editState?.mode === "edit" && editState.addressId === address.id ? (
              <AddressForm
                key={address.id}
                defaultValues={address}
                onSubmit={(values) => handleUpdate(address.id, values)}
                onCancel={() => setEditState(null)}
                submitLabel="Update Address"
              />
            ) : (
              <div key={address.id} className="border border-border p-6">
                <address className="text-sm not-italic text-luxe-gray-dark">
                  {address.firstName} {address.lastName}
                  <br />
                  {address.address1}
                  {address.address2 ? <>, {address.address2}</> : null}
                  <br />
                  {address.city}
                  {address.region ? `, ${address.region}` : ""} {address.postalCode}
                  <br />
                  {address.countryCode}
                </address>
                <div className="mt-4 flex gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditState({ mode: "edit", addressId: address.id })}
                    className="underline underline-offset-4 hover:text-luxe-black"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(address.id)}
                    className="text-destructive underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
