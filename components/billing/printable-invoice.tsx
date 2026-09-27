"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Invoice, InvoiceStatus } from "@/types/billing";
import { updateInvoiceStatus, deleteInvoice } from "@/lib/db/billing";
import { formatCurrency } from "@/lib/currency";
import { useRouter } from "next/navigation";

interface PrintableInvoiceProps {
  invoice: Invoice;
}

export function PrintableInvoice({ invoice: initialInvoice }: PrintableInvoiceProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (status: InvoiceStatus) => {
    startTransition(async () => {
      try {
        const amountPaid = status === "paid" ? invoice.total_amount : status === "cancelled" ? 0 : invoice.amount_paid;
        const updated = await updateInvoiceStatus(invoice.id, status, amountPaid);
        setInvoice(updated);
      } catch (err: unknown) {
        alert("Failed to update status: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}?`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteInvoice(invoice.id);
        router.push("/billing");
      } catch (err: unknown) {
        alert("Failed to delete invoice: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };


  const custDetails = (invoice.customer_details || {}) as Record<string, string>;
  const custName = custDetails.name || invoice.customer?.name || "Walk-in Retail Client";
  const custCompany = custDetails.company || invoice.customer?.company_name;
  const custEmail = custDetails.email || invoice.customer?.email;
  const custPhone = custDetails.phone || invoice.customer?.phone;
  const custTaxId = custDetails.tax_id || invoice.customer?.tax_id;
  const custAddress =
    custDetails.address ||
    (invoice.customer?.billing_address
      ? `${invoice.customer.billing_address.street || ""}, ${invoice.customer.billing_address.city || ""}, ${invoice.customer.billing_address.state || ""} ${invoice.customer.billing_address.postal_code || ""}`.trim()
      : null);

  const balanceDue = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar (Hidden during print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link href="/billing" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            All Invoices
          </Link>
          <span>/</span>
          <span className="font-mono text-neutral-900 dark:text-white font-medium">
            {invoice.invoice_number}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {invoice.status !== "paid" && (
            <button
              onClick={() => handleStatusChange("paid")}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              Mark as Paid
            </button>
          )}

          {invoice.status !== "cancelled" && (
            <button
              onClick={() => handleStatusChange("cancelled")}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              Cancel Invoice
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 shadow-sm transition-opacity flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Print / PDF
          </button>

          <button
            onClick={handleDelete}
            disabled={isPending}
            className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
            title="Delete invoice"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Printable Invoice Sheet */}
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-8 md:p-12 shadow-sm text-neutral-900 dark:text-neutral-100 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-neutral-200 dark:border-neutral-800 pb-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 flex items-center justify-center font-bold text-sm">
                I
              </div>
              <span className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
                INVENTRA
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Enterprise Inventory, Logistics & Invoicing Systems
            </p>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
              Tenant Org: {invoice.org_id}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <h1 className="text-2xl font-black font-mono tracking-tight text-neutral-950 dark:text-white">
              {invoice.invoice_number}
            </h1>
            <div className="mt-2 inline-flex items-center">
              {invoice.status === "paid" && (
                <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  ✓ Paid in Full
                </span>
              )}
              {invoice.status === "issued" && (
                <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  Payment Due
                </span>
              )}
              {invoice.status === "partially_paid" && (
                <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Partially Settled
                </span>
              )}
              {invoice.status === "draft" && (
                <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-neutral-500/10 text-neutral-600 border border-neutral-500/20">
                  Draft Copy
                </span>
              )}
              {invoice.status === "cancelled" && (
                <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-red-500/10 text-red-600 border border-red-500/20">
                  Cancelled
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-3 space-y-0.5">
              <div>
                <span className="text-neutral-400">Date Issued:</span>{" "}
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {invoice.issue_date}
                </span>
              </div>
              {invoice.due_date && (
                <div>
                  <span className="text-neutral-400">Payment Due:</span>{" "}
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {invoice.due_date}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Addresses & Payment Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 border-b border-neutral-200 dark:border-neutral-800 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-2">
              Billed To:
            </div>
            <div className="font-bold text-sm text-neutral-950 dark:text-white">
              {custName}
            </div>
            {custCompany && (
              <div className="text-neutral-700 dark:text-neutral-300 font-medium mt-0.5">
                {custCompany}
              </div>
            )}
            {custAddress && (
              <div className="text-neutral-500 mt-1.5 leading-relaxed">
                {custAddress}
              </div>
            )}
            <div className="mt-2 space-y-0.5 text-neutral-500">
              {custEmail && <div>Email: {custEmail}</div>}
              {custPhone && <div>Phone: {custPhone}</div>}
              {custTaxId && <div className="font-mono text-[11px]">Tax/VAT ID: {custTaxId}</div>}
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-2">
              Payment Terms & Settlement:
            </div>
            <div className="space-y-1 text-neutral-600 dark:text-neutral-400">
              <div>
                <span className="text-neutral-400">Payment Method:</span>{" "}
                <span className="font-semibold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  {invoice.payment_method?.replace("_", " ")}
                </span>
              </div>
              {invoice.payment_notes && (
                <div>
                  <span className="text-neutral-400">Reference:</span>{" "}
                  <span className="font-mono text-neutral-800 dark:text-neutral-200">
                    {invoice.payment_notes}
                  </span>
                </div>
              )}
              <div>
                <span className="text-neutral-400">Settlement Date:</span>{" "}
                <span className="text-neutral-800 dark:text-neutral-200">
                  {invoice.status === "paid" ? invoice.updated_at?.split("T")[0] || invoice.issue_date : "Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-8">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-neutral-400 font-medium">
                <th className="py-2 pr-4 w-10">#</th>
                <th className="py-2 pr-4">Item & Description</th>
                <th className="py-2 px-4 text-center">Qty</th>
                <th className="py-2 px-4 text-right">Unit Rate</th>
                <th className="py-2 px-4 text-right">Tax</th>
                <th className="py-2 pl-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {(!invoice.items || invoice.items.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-neutral-500">
                    No line items listed on this invoice record.
                  </td>
                </tr>
              ) : (
                invoice.items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-3 pr-4 text-neutral-400 font-mono">{idx + 1}</td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {it.item_name}
                      </div>
                      {it.sku && (
                        <div className="text-[10px] text-neutral-500 font-mono">
                          SKU: {it.sku}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{it.quantity}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(it.unit_price)}</td>
                    <td className="py-3 px-4 text-right text-neutral-500">
                      {it.tax_rate}% ({formatCurrency(it.tax_amount)})
                    </td>
                    <td className="py-3 pl-4 text-right font-semibold text-neutral-950 dark:text-white">
                      {formatCurrency(it.line_total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals & Notes Section */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1.5">
              Terms & Conditions
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-sm">
              {invoice.terms_and_conditions ||
                "Payment is due as per agreed net credit terms. For inquiries regarding this commercial statement, please contact accounts@inventra.enterprise."}
            </p>

            <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800/60 max-w-xs">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Authorized Signatory
              </div>
              <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-2">
                Inventra Multi-Tenant Enterprise Operations
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Subtotal</span>
              <span className="font-medium text-neutral-900 dark:text-white">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>

            {Number(invoice.discount_value || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount Applied</span>
                <span>-{formatCurrency(invoice.discount_value)}</span>
              </div>
            )}

            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Estimated Tax Total</span>
              <span className="font-medium text-neutral-900 dark:text-white">
                +{formatCurrency(invoice.tax_total)}
              </span>
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2 flex justify-between text-base font-black text-neutral-950 dark:text-white">
              <span>Total Invoice Amount</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>

            <div className="flex justify-between text-xs pt-1 border-t border-neutral-100 dark:border-neutral-900">
              <span className="text-neutral-500">Amount Paid</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(invoice.amount_paid)}
              </span>
            </div>

            <div className="flex justify-between text-xs pt-0.5">
              <span className="text-neutral-500">Balance Due</span>
              <span className={`font-bold font-mono ${balanceDue > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {balanceDue > 0 ? formatCurrency(balanceDue) : "Settled (₹0.00)"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
