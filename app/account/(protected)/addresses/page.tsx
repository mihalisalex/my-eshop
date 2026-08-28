"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCommerceProvider } from "@/lib/commerce";
import { AddressForm } from "@/components/account/AddressForm";
import { useToast } from "@/components/providers/ToastProvider";
import type { AddressFormValues } from "@/lib/validation/checkout";
import { useTranslations } from "next-intl";

type EditState = { mode: "add" } | { mode: "edit"; addressId: string } | null;

export default function AccountAddressesPage() {
  const t = useTranslations("Account");
  const { customer, refreshCustomer } = useAuth();
  const { toast } = useToast();
  const [editState, setEditState] = useState<EditState>(null);

  if (!customer) return null;

  const commerce = getCommerceProvider();

  const handleAdd = async (values: AddressFormValues) => {
    await commerce.customer.addAddress(customer.id, values);
    await refreshCustomer();
    setEditState(null);
    toast({ title: t("addressAdded"), tone: "success" });
  };

  const handleUpdate = async (addressId: string, values: AddressFormValues) => {
    await commerce.customer.updateAddress(customer.id, addressId, values);
    await refreshCustomer();
    setEditState(null);
    toast({ title: t("addressUpdated"), tone: "success" });
  };

  const handleRemove = async (addressId: string) => {
    await commerce.customer.removeAddress(customer.id, addressId);
    await refreshCustomer();
    toast({ title: t("addressRemoved") });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">{t("addresses")}</h1>
        {editState === null ? (
          <button
            type="button"
            onClick={() => setEditState({ mode: "add" })}
            className="flex items-center gap-1.5 text-sm underline underline-offset-4 hover:text-luxe-black"
          >
            <Plus className="size-4" strokeWidth={1.5} />
            {t("addAddress")}
          </button>
        ) : null}
      </div>

      {editState?.mode === "add" ? (
        <div className="mt-6">
          <AddressForm onSubmit={handleAdd} onCancel={() => setEditState(null)} submitLabel={t("addAddress")} />
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
                // Phone became required, but addresses saved before that change may not
                // have one — seed the field empty so the form asks for it rather than
                // failing to render an address the customer already has.
                defaultValues={{ ...address, phone: address.phone ?? "" }}
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
                    {t("edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(address.id)}
                    className="text-destructive underline underline-offset-4"
                  >
                    {t("remove")}
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
