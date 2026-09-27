"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Customer, Invoice } from "@/types/billing";
import { CustomerModal } from "@/components/customers/customer-modal";
import { formatCurrency } from "@/lib/currency";

interface CustomerProfileViewProps {
  customer: Customer;
  invoices: Invoice[];
}

export function CustomerProfileView({
  customer: initialCustomer,
  invoices,
}: CustomerProfileViewProps) {
  const [customer] = useState<Customer>(initialCustomer);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Financial Analytics
  const financials = useMemo(() => {
    let lifetimeVolume = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;

    for (const inv of invoices) {
      if (inv.status !== "cancelled") {
        lifetimeVolume += inv.total_amount;
        totalPaid += inv.amount_paid;
        const balance = Math.max(0, inv.total_amount - inv.amount_paid);
        outstandingBalance += balance;
      }
    }

    return {
      lifetimeVolume,
      totalPaid,
      outstandingBalance,
      invoiceCount: invoices.length,
    };
  }, [invoices]);

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            PAID
          </span>
        );
      case "issued":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            ISSUED (UNPAID)
          </span>
        );
      case "partially_paid":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
            PARTIAL
          </span>
        );
      case "draft":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            DRAFT
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 text-neutral-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/customers"
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            &larr; Customers Directory
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span className="font-semibold text-neutral-900 dark:text-white">{customer.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Edit Profile
          </button>
          <Link
            href={`/billing/new?customer_id=${customer.id}`}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs"
          >
            + Create Invoice
          </Link>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 bg-white dark:bg-[#121215] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
                {customer.name}
              </h1>
              {customer.company_name && (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                  Corporate
                </span>
              )}
            </div>

            {customer.company_name && (
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 font-mono">
                {customer.company_name}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 font-mono pt-1">
              {customer.email && (
                <div className="flex items-center gap-1.5">
                  <span>✉</span>
                  <a href={`mailto:${customer.email}`} className="hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <span>📞</span>
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.tax_id && (
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">Tax ID:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {customer.tax_id}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Outstanding Balance Banner */}
          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 text-right min-w-[180px]">
            <div className="text-[10px] font-mono text-neutral-500 uppercase">
              Outstanding Balance
            </div>
            <div
              className={`text-lg font-bold font-mono mt-0.5 ${
                financials.outstandingBalance > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {formatCurrency(financials.outstandingBalance)}
            </div>
            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
              {financials.outstandingBalance > 0 ? "Payment pending" : "All accounts clear"}
            </div>
          </div>
        </div>

        {/* Structured Addresses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          {/* Billing Address */}
          <div className="p-3.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/40 dark:bg-neutral-900/30 text-xs space-y-1">
            <div className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono text-[11px] uppercase tracking-wider">
              Billing Address
            </div>
            {customer.billing_address?.street ? (
              <div className="text-neutral-600 dark:text-neutral-400 space-y-0.5 pt-0.5">
                <div>{customer.billing_address.street}</div>
                <div>
                  {[customer.billing_address.city, customer.billing_address.state, customer.billing_address.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div className="font-medium text-neutral-800 dark:text-neutral-200">
                  {customer.billing_address.country}
                </div>
              </div>
            ) : (
              <div className="text-neutral-400 italic pt-1">No billing address on file.</div>
            )}
          </div>

          {/* Shipping Address */}
          <div className="p-3.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/40 dark:bg-neutral-900/30 text-xs space-y-1">
            <div className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono text-[11px] uppercase tracking-wider">
              Shipping Address
            </div>
            {customer.shipping_address?.street ? (
              <div className="text-neutral-600 dark:text-neutral-400 space-y-0.5 pt-0.5">
                <div>{customer.shipping_address.street}</div>
                <div>
                  {[customer.shipping_address.city, customer.shipping_address.state, customer.shipping_address.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <div className="font-medium text-neutral-800 dark:text-neutral-200">
                  {customer.shipping_address.country}
                </div>
              </div>
            ) : (
              <div className="text-neutral-400 italic pt-1">Same as billing address.</div>
            )}
          </div>
        </div>

        {customer.notes && (
          <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-neutral-900/60 text-xs text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="font-semibold font-mono text-[11px] uppercase text-neutral-500 mr-2">
              Terms & Notes:
            </span>
            {customer.notes}
          </div>
        )}
      </div>

      {/* KPI Financials Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Lifetime Order Volume
          </div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {formatCurrency(financials.lifetimeVolume)}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Total Paid Revenue
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCurrency(financials.totalPaid)}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Outstanding Balance
          </div>
          <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
            {formatCurrency(financials.outstandingBalance)}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Total Invoices
          </div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {financials.invoiceCount}
          </div>
        </div>
      </div>

      {/* Historical Invoices & Purchase History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white font-mono uppercase tracking-wider">
            Purchase History & Invoices
          </h2>
          <span className="text-xs text-neutral-500">
            {invoices.length} historical invoices recorded
          </span>
        </div>

        {/* Mobile Purchase History Cards */}
        <div className="md:hidden space-y-3">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-[#101014]">
              <div className="text-2xl mb-1">🧾</div>
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">No invoices recorded</p>
            </div>
          ) : (
            invoices.map((inv) => {
              const balanceDue = Math.max(0, inv.total_amount - inv.amount_paid);

              return (
                <div
                  key={inv.id}
                  className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 bg-white dark:bg-[#101014] shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/billing/${inv.id}`}
                        className="font-mono font-bold text-sm text-neutral-950 dark:text-white hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                      <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{inv.issue_date}</div>
                    </div>
                    <div>{getStatusBadge(inv.status)}</div>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex justify-between items-baseline">
                    <span className="text-[10px] text-neutral-400 uppercase font-mono">{inv.payment_method.replace("_", " ")}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-neutral-950 dark:text-white">
                        {formatCurrency(inv.total_amount)}
                      </div>
                      <div className="text-[10px]">
                        {balanceDue === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Paid in full</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-mono">Due: {formatCurrency(balanceDue)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 text-right">
                    <Link
                      href={`/billing/${inv.id}`}
                      className="inline-block px-3 py-1 rounded text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90"
                    >
                      View Invoice
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Invoices Table */}
        <div className="hidden md:block border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-[#101014] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 font-mono select-none">
                  <th className="py-2.5 px-3.5 font-medium">Invoice #</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Method</th>
                  <th className="py-2.5 px-3 font-medium text-right">Subtotal (₹)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Tax (₹)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Total (₹)</th>
                  <th className="py-2.5 px-3.5 font-medium text-right pr-4">Paid (₹)</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
                {invoices.map((inv) => {
                  const balanceDue = Math.max(0, inv.total_amount - inv.amount_paid);

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors"
                    >
                      {/* Invoice Number */}
                      <td className="py-2.5 px-3.5 font-mono font-medium text-neutral-950 dark:text-white">
                        <Link
                          href={`/billing/${inv.id}`}
                          className="hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {inv.issue_date}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getStatusBadge(inv.status)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-2.5 px-3 font-mono text-[11px] uppercase text-neutral-600 dark:text-neutral-400">
                        {inv.payment_method.replace("_", " ")}
                      </td>

                      {/* Subtotal */}
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {formatCurrency(inv.subtotal)}
                      </td>

                      {/* Tax */}
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {formatCurrency(inv.tax_total)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-950 dark:text-white">
                        {formatCurrency(inv.total_amount)}
                      </td>

                      {/* Amount Paid & Balance */}
                      <td className="py-2.5 px-3.5 text-right pr-4 font-mono">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {formatCurrency(inv.amount_paid)}
                        </div>
                        {balanceDue > 0 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400">
                            Due: {formatCurrency(balanceDue)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-neutral-400">
                      <div className="max-w-xs mx-auto space-y-1">
                        <div className="text-xl">🧾</div>
                        <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          No invoices recorded for this customer
                        </div>
                        <div className="pt-2">
                          <Link
                            href={`/billing/new?customer_id=${customer.id}`}
                            className="inline-block px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium cursor-pointer"
                          >
                            + Issue First Invoice
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      {isEditModalOpen && (
        <CustomerModal
          isOpen={isEditModalOpen}
          initialData={customer}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
