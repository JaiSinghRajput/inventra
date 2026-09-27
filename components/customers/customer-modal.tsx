"use client";

import { useState, useTransition } from "react";
import { Customer } from "@/types/billing";
import { createCustomer, updateCustomer } from "@/lib/db/billing";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Customer | null;
}

export function CustomerModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: CustomerModalProps) {
  const isEditing = !!initialData;
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState(initialData?.name || "");
  const [companyName, setCompanyName] = useState(initialData?.company_name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [taxId, setTaxId] = useState(initialData?.tax_id || "");
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Billing Address JSONB
  const [billingStreet, setBillingStreet] = useState(initialData?.billing_address?.street || "");
  const [billingCity, setBillingCity] = useState(initialData?.billing_address?.city || "");
  const [billingState, setBillingState] = useState(initialData?.billing_address?.state || "");
  const [billingPostal, setBillingPostal] = useState(initialData?.billing_address?.postal_code || "");
  const [billingCountry, setBillingCountry] = useState(initialData?.billing_address?.country || "USA");

  // Shipping Address JSONB
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(
    !initialData ||
      JSON.stringify(initialData.billing_address) === JSON.stringify(initialData.shipping_address)
  );
  const [shippingStreet, setShippingStreet] = useState(initialData?.shipping_address?.street || "");
  const [shippingCity, setShippingCity] = useState(initialData?.shipping_address?.city || "");
  const [shippingState, setShippingState] = useState(initialData?.shipping_address?.state || "");
  const [shippingPostal, setShippingPostal] = useState(initialData?.shipping_address?.postal_code || "");
  const [shippingCountry, setShippingCountry] = useState(initialData?.shipping_address?.country || "USA");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Contact name is required.");
      return;
    }

    const billingAddress = {
      street: billingStreet.trim(),
      city: billingCity.trim(),
      state: billingState.trim(),
      postal_code: billingPostal.trim(),
      country: billingCountry.trim(),
    };

    const shippingAddress = shippingSameAsBilling
      ? billingAddress
      : {
          street: shippingStreet.trim(),
          city: shippingCity.trim(),
          state: shippingState.trim(),
          postal_code: shippingPostal.trim(),
          country: shippingCountry.trim(),
        };

    startTransition(async () => {
      try {
        if (isEditing && initialData) {
          await updateCustomer(initialData.id, {
            name: name.trim(),
            company_name: companyName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            tax_id: taxId.trim() || null,
            billing_address: billingAddress,
            shipping_address: shippingAddress,
            notes: notes.trim() || null,
          });
        } else {
          await createCustomer({
            name: name.trim(),
            company_name: companyName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            tax_id: taxId.trim() || null,
            billing_address: billingAddress,
            shipping_address: shippingAddress,
            notes: notes.trim() || null,
            metadata: {},
          });
        }

        onSuccess();
        onClose();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to save customer account."
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-900/40">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              {isEditing ? "Edit Customer Profile" : "Register New Customer"}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Client profile with Tax ID, billing rules, and structured address storage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Section 1: Contact & Company */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
              1. Contact & Corporate Identity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Full Name (Primary Contact) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex HyperScale Technologies Inc."
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. arivera@company.com"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 349-8201"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tax ID / GSTIN / VAT
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. 27AABCZ1234F1Z8"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono font-medium"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 2: Structured Billing Address */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
              2. Billing Address (Stored as JSONB)
            </h3>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={billingStreet}
                onChange={(e) => setBillingStreet(e.target.value)}
                placeholder="100 Innovation Way, Suite 400"
                className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  placeholder="San Francisco"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  State / Region
                </label>
                <input
                  type="text"
                  value={billingState}
                  onChange={(e) => setBillingState(e.target.value)}
                  placeholder="CA"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={billingPostal}
                  onChange={(e) => setBillingPostal(e.target.value)}
                  placeholder="94107"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={billingCountry}
                  onChange={(e) => setBillingCountry(e.target.value)}
                  placeholder="USA"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 3: Shipping Address */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                3. Shipping Address
              </h3>
              <label className="flex items-center gap-2 cursor-pointer text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={shippingSameAsBilling}
                  onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                  className="rounded text-neutral-900 dark:text-white"
                />
                <span>Same as Billing Address</span>
              </label>
            </div>

            {!shippingSameAsBilling && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={shippingStreet}
                    onChange={(e) => setShippingStreet(e.target.value)}
                    placeholder="Warehouse Dock 4, 100 Innovation Way"
                    className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="San Francisco"
                      className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      State / Region
                    </label>
                    <input
                      type="text"
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      placeholder="CA"
                      className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={shippingPostal}
                      onChange={(e) => setShippingPostal(e.target.value)}
                      placeholder="94107"
                      className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      placeholder="USA"
                      className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 4: Notes */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Internal Account Notes / Payment Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Net-30 payment terms. Requires purchase order PO on delivery."
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#121215] py-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isPending && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              <span>{isEditing ? "Update Customer" : "Save Customer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
