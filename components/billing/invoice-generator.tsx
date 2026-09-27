"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Customer, PaymentMethod, InvoiceStatus } from "@/types/billing";
import { InventoryItem } from "@/types/inventory";
import { createInvoiceWithItems } from "@/lib/db/billing";
import { formatCurrency } from "@/lib/currency";

interface InvoiceGeneratorProps {
  initialProducts: InventoryItem[];
  initialCustomers: Customer[];
  defaultInvoiceNumber: string;
  preselectedCustomerId?: string;
}

interface EditableLineItem {
  tempId: string;
  itemId?: string;
  name: string;
  sku?: string;
  stockAvailable: number;
  quantity: number;
  unitPrice: number;
  buyPrice: number;
  taxRate: number;
  discountAmount: number;
}

export function InvoiceGenerator({
  initialProducts,
  initialCustomers,
  defaultInvoiceNumber,
  preselectedCustomerId,
}: InvoiceGeneratorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Invoice Details
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [paymentStatus, setPaymentStatus] = useState<InvoiceStatus>("paid");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [terms, setTerms] = useState("Payment is due within 30 days of invoice date. Goods once sold are non-refundable.");

  // Customer Selection
  const initialCust = initialCustomers.find((c) => c.id === preselectedCustomerId) || null;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(preselectedCustomerId || "walk_in");
  const [guestName, setGuestName] = useState(initialCust?.name || "Walk-in Retail Client");
  const [guestCompany, setGuestCompany] = useState(initialCust?.company_name || "");
  const [guestEmail, setGuestEmail] = useState(initialCust?.email || "");
  const [guestPhone, setGuestPhone] = useState(initialCust?.phone || "");
  const [guestTaxId, setGuestTaxId] = useState(initialCust?.tax_id || "");
  const [guestAddress, setGuestAddress] = useState(
    initialCust?.billing_address
      ? `${initialCust.billing_address.street || ""}, ${initialCust.billing_address.city || ""}, ${initialCust.billing_address.state || ""}`.replace(/^, |, $/g, "")
      : ""
  );

  // Line Items
  const [items, setItems] = useState<EditableLineItem[]>([]);

  // Search & Barcode
  const [productSearch, setProductSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Amount Paid override
  const [customAmountPaid, setCustomAmountPaid] = useState<number | null>(null);

  // Filter products for search
  const searchedProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return [];
    return initialProducts
      .filter((p) => {
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        const matchBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
        return matchName || matchSku || matchBarcode || matchBrand;
      })
      .slice(0, 8);
  }, [initialProducts, productSearch]);

  // Handle barcode quick-scan / enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const match = initialProducts.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    if (match) {
      addProductToLines(match);
      setBarcodeInput("");
      setValidationError(null);
    } else {
      setValidationError(`No product found with barcode or SKU: "${code}"`);
    }
  };

  const addProductToLines = (product: InventoryItem) => {
    if (product.stock_quantity <= 0) {
      alert(`Cannot add "${product.name}" because it is currently OUT OF STOCK.`);
      return;
    }

    setItems((prev) => {
      // Check if already in lines
      const existingIndex = prev.findIndex((it) => it.itemId === product.id);
      if (existingIndex >= 0) {
        const current = prev[existingIndex];
        if (current.quantity >= product.stock_quantity) {
          alert(`Maximum available stock reached for ${product.name} (${product.stock_quantity} available).`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...current,
          quantity: current.quantity + 1,
        };
        return updated;
      }

      return [
        ...prev,
        {
          tempId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          itemId: product.id,
          name: product.name,
          sku: product.sku,
          stockAvailable: product.stock_quantity,
          quantity: 1,
          unitPrice: Number(product.sell_price || 0),
          buyPrice: Number(product.buy_price || 0),
          taxRate: Number(product.tax_rate || 0),
          discountAmount: 0,
        },
      ];
    });

    setProductSearch("");
  };

  const updateLineItem = (tempId: string, updates: Partial<EditableLineItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.tempId !== tempId) return it;
        const updated = { ...it, ...updates };

        // Enforce quantity bounds
        if (updated.quantity < 1) updated.quantity = 1;
        if (updated.quantity > updated.stockAvailable) {
          updated.quantity = updated.stockAvailable;
          alert(`Quantity restricted to maximum available stock (${updated.stockAvailable} available).`);
        }
        return updated;
      })
    );
  };

  const removeLineItem = (tempId: string) => {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  };

  // When customer changes from dropdown
  const handleCustomerChange = (custId: string) => {
    setSelectedCustomerId(custId);
    if (custId === "walk_in") {
      setGuestName("Walk-in Retail Client");
      setGuestCompany("");
      setGuestEmail("");
      setGuestPhone("");
      setGuestTaxId("");
      setGuestAddress("");
    } else {
      const found = initialCustomers.find((c) => c.id === custId);
      if (found) {
        setGuestName(found.name);
        setGuestCompany(found.company_name || "");
        setGuestEmail(found.email || "");
        setGuestPhone(found.phone || "");
        setGuestTaxId(found.tax_id || "");
        setGuestAddress(
          found.billing_address
            ? `${found.billing_address.street || ""}, ${found.billing_address.city || ""}, ${found.billing_address.state || ""}`.replace(/^, |, $/g, "")
            : ""
        );
      }
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const it of items) {
      const lineSubtotal = it.unitPrice * it.quantity;
      const discount = it.discountAmount;
      const taxableAmount = Math.max(0, lineSubtotal - discount);
      const tax = (taxableAmount * it.taxRate) / 100;

      subtotal += lineSubtotal;
      totalDiscount += discount;
      totalTax += tax;
    }

    const totalAmount = Math.max(0, subtotal - totalDiscount + totalTax);

    let amountPaid = 0;
    if (paymentStatus === "paid") {
      amountPaid = totalAmount;
    } else if (paymentStatus === "issued" || paymentStatus === "draft") {
      amountPaid = 0;
    } else if (paymentStatus === "partially_paid") {
      amountPaid = customAmountPaid !== null ? customAmountPaid : totalAmount / 2;
    }

    const balanceDue = Math.max(0, totalAmount - amountPaid);

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount,
      amountPaid,
      balanceDue,
    };
  }, [items, paymentStatus, customAmountPaid]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      setValidationError("Please add at least one inventory product to generate the invoice.");
      return;
    }

    if (!guestName.trim()) {
      setValidationError("Please enter customer name or select a valid client profile.");
      return;
    }

    setValidationError(null);

    startTransition(async () => {
      try {
        const lineItemsPayload = items.map((it) => {
          const lineSub = it.unitPrice * it.quantity;
          const taxable = Math.max(0, lineSub - it.discountAmount);
          const taxAmt = (taxable * it.taxRate) / 100;
          const lineTot = taxable + taxAmt;

          return {
            item_id: it.itemId || null,
            item_name: it.name,
            sku: it.sku || null,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            buy_price: it.buyPrice,
            tax_rate: it.taxRate,
            tax_amount: parseFloat(taxAmt.toFixed(2)),
            discount_amount: it.discountAmount,
            line_total: parseFloat(lineTot.toFixed(2)),
          };
        });

        const invoicePayload = {
          invoice_number: invoiceNumber.trim(),
          customer_id: selectedCustomerId === "walk_in" ? null : selectedCustomerId,
          customer_details: {
            name: guestName.trim(),
            company: guestCompany.trim() || undefined,
            email: guestEmail.trim() || undefined,
            phone: guestPhone.trim() || undefined,
            tax_id: guestTaxId.trim() || undefined,
            address: guestAddress.trim() || undefined,
          },
          issue_date: issueDate,
          due_date: dueDate || null,
          status: paymentStatus,
          subtotal: parseFloat(calculations.subtotal.toFixed(2)),
          discount_type: "fixed" as const,
          discount_value: parseFloat(calculations.totalDiscount.toFixed(2)),
          tax_total: parseFloat(calculations.totalTax.toFixed(2)),
          total_amount: parseFloat(calculations.totalAmount.toFixed(2)),
          amount_paid: parseFloat(calculations.amountPaid.toFixed(2)),
          payment_method: paymentMethod,
          payment_notes: paymentNotes.trim() || null,
          terms_and_conditions: terms.trim() || null,
        };

        const created = await createInvoiceWithItems(invoicePayload, lineItemsPayload);
        router.push(`/billing/${created.id}`);
      } catch (err: unknown) {
        setValidationError(err instanceof Error ? err.message : String(err));
      }
    });
  };


  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <Link href="/billing" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
              Billing
            </Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-200 font-medium">New Invoice</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Interactive Invoice Generator & POS
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/billing"
            className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={isPending || items.length === 0}
            className="px-4 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processing Sale...
              </>
            ) : (
              <>Generate Invoice & Deduct Stock</>
            )}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span>
            <span>{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-red-500 hover:text-red-800 dark:hover:text-red-200 text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Search & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode & Product Search Panel */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-950 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Quick Barcode Scanner Input */}
              <form onSubmit={handleBarcodeSubmit} className="flex-1 flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50/50 dark:bg-neutral-900/40 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 transition-colors">
                <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM15 15h2.25v2.25H15V15zm0 4.5h2.25V21H15v-1.5zm-3-4.5h2.25v2.25H12V15zm0 4.5h2.25V21H12v-1.5zm6-4.5h2.25v2.25H18V15zm0 4.5h2.25V21H18v-1.5z" />
                </svg>
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode or enter SKU & press Enter..."
                  className="w-full bg-transparent text-xs text-neutral-900 dark:text-white focus:outline-none placeholder:text-neutral-400"
                />
                <button
                  type="submit"
                  className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                >
                  Scan
                </button>
              </form>

              {/* Product Catalog Search */}
              <div className="relative flex-1">
                <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50/50 dark:bg-neutral-900/40 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 transition-colors">
                  <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search catalog by name, brand, SKU..."
                    className="w-full bg-transparent text-xs text-neutral-900 dark:text-white focus:outline-none placeholder:text-neutral-400"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch("")}
                      className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {searchedProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                    {searchedProducts.map((p) => {
                      const isOutOfStock = p.stock_quantity <= 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => addProductToLines(p)}
                          className={`w-full p-2.5 text-left flex items-center justify-between text-xs transition-colors ${
                            isOutOfStock
                              ? "opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-950"
                              : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                          }`}
                        >
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.brand && (
                                <span className="text-[10px] text-neutral-500 font-normal">
                                  ({p.brand})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                              SKU: {p.sku} {p.barcode && `• Barcode: ${p.barcode}`}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-neutral-950 dark:text-white">
                              {formatCurrency(p.sell_price)}
                            </div>
                            <div className="mt-0.5">
                              {isOutOfStock ? (
                                <span className="text-[10px] font-medium text-red-500">
                                  Out of Stock
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                  {p.stock_quantity} available
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                Line Items ({items.length})
              </span>
              <span className="text-[11px] text-neutral-500">
                Live Stock Validation & Auto-Tax
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 space-y-2">
                <div className="text-3xl">🛒</div>
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  No line items added yet
                </p>
                <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                  Search catalog products or scan a barcode above to instantly add items to this invoice.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/20 text-neutral-500 font-medium">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">Stock</th>
                      <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                      <th className="py-2.5 px-3 text-right w-24">Price (₹)</th>
                      <th className="py-2.5 px-3 text-right w-20">Tax %</th>
                      <th className="py-2.5 px-3 text-right w-24">Disc (₹)</th>
                      <th className="py-2.5 px-3 text-right w-28">Total</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                    {items.map((line) => {
                      const lineSub = line.unitPrice * line.quantity;
                      const taxable = Math.max(0, lineSub - line.discountAmount);
                      const taxAmt = (taxable * line.taxRate) / 100;
                      const lineTot = taxable + taxAmt;

                      return (
                        <tr key={line.tempId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-medium text-neutral-900 dark:text-white">
                              {line.name}
                            </div>
                            {line.sku && (
                              <div className="text-[10px] font-mono text-neutral-500">
                                SKU: {line.sku}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                              {line.stockAvailable} left
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900">
                              <button
                                type="button"
                                onClick={() => updateLineItem(line.tempId, { quantity: line.quantity - 1 })}
                                className="px-2 py-1 text-neutral-500 hover:text-neutral-950 dark:hover:text-white text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={line.stockAvailable}
                                value={line.quantity}
                                onChange={(e) =>
                                  updateLineItem(line.tempId, {
                                    quantity: parseInt(e.target.value, 10) || 1,
                                  })
                                }
                                className="w-12 text-center text-xs font-semibold bg-transparent border-none focus:outline-none text-neutral-950 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => updateLineItem(line.tempId, { quantity: line.quantity + 1 })}
                                className="px-2 py-1 text-neutral-500 hover:text-neutral-950 dark:hover:text-white text-xs"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) =>
                                updateLineItem(line.tempId, {
                                  unitPrice: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-20 text-right px-1.5 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none"
                            />
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={line.taxRate}
                              onChange={(e) =>
                                updateLineItem(line.tempId, {
                                  taxRate: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-16 text-right px-1.5 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none"
                            />
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.discountAmount}
                              onChange={(e) =>
                                updateLineItem(line.tempId, {
                                  discountAmount: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-18 text-right px-1.5 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none"
                            />
                          </td>

                          <td className="py-3 px-3 text-right font-medium text-neutral-950 dark:text-white">
                            {formatCurrency(lineTot)}
                          </td>

                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLineItem(line.tempId)}
                              className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes & Terms */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-950 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Terms & Additional Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Payment Reference / Transaction ID
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. UPI Ref #89210948, Check #402, Wire Ref"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Terms & Conditions
                </label>
                <input
                  type="text"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Invoice policy, warranty or payment terms"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Customer Details & Financial Checkout */}
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-950 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                Customer / Bill To
              </h2>
              <Link
                href="/customers"
                target="_blank"
                className="text-[11px] text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:underline"
              >
                + Manage Clients
              </Link>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Select Client Account
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none"
              >
                <option value="walk_in">👤 Walk-in / Guest Client</option>
                {initialCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company_name ? `(${c.company_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:divide-neutral-900">
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase">
                  Client / Contact Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={guestCompany}
                  onChange={(e) => setGuestCompany(e.target.value)}
                  placeholder="Optional corporate legal entity"
                  className="w-full px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-neutral-500 uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-neutral-500 uppercase">
                    Tax / VAT ID
                  </label>
                  <input
                    type="text"
                    value={guestTaxId}
                    onChange={(e) => setGuestTaxId(e.target.value)}
                    placeholder="GSTIN / EIN"
                    className="w-full px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase">
                  Billing Address
                </label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="Street, City, State, Country"
                  className="w-full px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Invoice Parameters & Payment Method */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-950 shadow-sm space-y-4">
            <h2 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Payment & Schedule
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-2 py-1.5 rounded font-mono border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                >
                  <option value="card">Card Terminal</option>
                  <option value="cash">Cash Register</option>
                  <option value="upi">UPI / Instant QR</option>
                  <option value="bank_transfer">Wire / Bank Transfer</option>
                  <option value="credit">Net-30 Corporate Credit</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">
                Settlement Status
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["paid", "issued", "partially_paid"] as InvoiceStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setPaymentStatus(status);
                      if (status === "partially_paid" && customAmountPaid === null) {
                        setCustomAmountPaid(Math.round(calculations.totalAmount / 2));
                      }
                    }}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition-all cursor-pointer ${
                      paymentStatus === status
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    }`}
                  >
                    {status === "paid" ? "Paid (Full)" : status === "issued" ? "Unpaid" : "Partial"}
                  </button>
                ))}
              </div>
            </div>

            {paymentStatus === "partially_paid" && (
              <div>
                <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">
                  Amount Collected Now (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={calculations.totalAmount}
                  value={customAmountPaid ?? ""}
                  onChange={(e) => setCustomAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-950 dark:text-white focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Totals Summary */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-neutral-50/50 dark:bg-neutral-900/30 shadow-sm space-y-3">
            <h2 className="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Summary Calculation
            </h2>

            <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex justify-between">
                <span>Subtotal ({items.reduce((acc, it) => acc + it.quantity, 0)} units)</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {formatCurrency(calculations.subtotal)}
                </span>
              </div>

              {calculations.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Total Discounts</span>
                  <span>-{formatCurrency(calculations.totalDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Estimated Tax Total</span>
                <span className="font-medium text-neutral-900 dark:text-white">
                  +{formatCurrency(calculations.totalTax)}
                </span>
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2 flex justify-between text-sm font-bold text-neutral-950 dark:text-white">
                <span>Grand Total</span>
                <span>{formatCurrency(calculations.totalAmount)}</span>
              </div>

              <div className="flex justify-between text-xs pt-1">
                <span>Amount Paid</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(calculations.amountPaid)}
                </span>
              </div>

              <div className="flex justify-between text-xs pt-0.5">
                <span>Balance Due</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(calculations.balanceDue)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || items.length === 0}
                className="w-full py-2.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm text-center flex items-center justify-center gap-2"
              >
                {isPending ? "Generating Invoice..." : "Complete & Issue Invoice"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
