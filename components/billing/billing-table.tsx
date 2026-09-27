"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Invoice, InvoiceStatus } from "@/types/billing";
import { updateInvoiceStatus, deleteInvoice, seedSampleCustomers } from "@/lib/db/billing";
import { formatCurrency } from "@/lib/currency";

interface BillingTableProps {
  initialInvoices: Invoice[];
}

export function BillingTable({ initialInvoices }: BillingTableProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let pendingCount = 0;
    let paidCount = 0;

    for (const inv of invoices) {
      if (inv.status !== "cancelled") {
        totalInvoiced += Number(inv.total_amount || 0);
        totalPaid += Number(inv.amount_paid || 0);
      }
      if (inv.status === "paid") {
        paidCount++;
      } else if (inv.status === "issued" || inv.status === "partially_paid") {
        pendingCount++;
      }
    }

    const outstanding = Math.max(0, totalInvoiced - totalPaid);

    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      count: invoices.length,
      paidCount,
      pendingCount,
    };
  }, [invoices]);

  // Filtered list
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return invoices.filter((inv) => {
      // Search query
      if (q) {
        const matchNum = inv.invoice_number?.toLowerCase().includes(q);
        const custName = String(inv.customer_details?.name || inv.customer?.name || "").toLowerCase();
        const custCompany = String(inv.customer_details?.company || inv.customer?.company_name || "").toLowerCase();
        const matchCust = custName.includes(q) || custCompany.includes(q);
        if (!matchNum && !matchCust) return false;
      }

      // Status
      if (statusFilter !== "all" && inv.status !== statusFilter) {
        return false;
      }

      // Payment method
      if (paymentFilter !== "all" && inv.payment_method !== paymentFilter) {
        return false;
      }

      return true;
    });
  }, [invoices, searchQuery, statusFilter, paymentFilter]);

  const handleQuickMarkPaid = (inv: Invoice) => {
    startTransition(async () => {
      try {
        const updated = await updateInvoiceStatus(inv.id, "paid", inv.total_amount);
        setInvoices((prev) => prev.map((item) => (item.id === inv.id ? updated : item)));
      } catch (err: unknown) {
        alert("Failed to mark invoice as paid: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleDelete = (id: string, invNum: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${invNum}? This action cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteInvoice(id);
        setInvoices((prev) => prev.filter((item) => item.id !== id));
      } catch (err: unknown) {
        alert("Failed to delete invoice: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleSeed = () => {
    startTransition(async () => {
      try {
        await seedSampleCustomers();
        window.location.reload();
      } catch (err: unknown) {
        alert("Failed to seed demo data: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };


  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Paid
          </span>
        );
      case "issued":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
            Issued
          </span>
        );
      case "partially_paid":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Partial
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20">
            Draft
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Billing & Invoicing
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Enterprise invoices, POS terminal checkout, receivables tracking, and audit-ready receipts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {invoices.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Seed Demo Invoices
            </button>
          )}
          <Link
            href="/billing/new"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-950 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Invoice
          </Link>
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Total Invoiced
          </div>
          <div className="text-xl font-bold text-neutral-950 dark:text-white mt-1">
            {formatCurrency(metrics.totalInvoiced)}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            {metrics.count} total generated invoices
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Collected Revenue
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(metrics.totalPaid)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            {metrics.paidCount} settled orders
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Outstanding Receivables
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(metrics.outstanding)}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            {metrics.pendingCount} unpaid / partial
          </div>
        </div>

        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Fulfillment Rate
          </div>
          <div className="text-xl font-bold text-neutral-950 dark:text-white mt-1">
            {metrics.count > 0
              ? `${Math.round((metrics.paidCount / metrics.count) * 100)}%`
              : "0%"}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">
            Paid invoices vs total
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 rounded-lg shadow-sm">
          <svg
            className="w-4 h-4 text-neutral-400 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice #, customer name, company..."
            className="w-full bg-transparent border-none text-xs text-neutral-900 dark:text-white focus:outline-none placeholder:text-neutral-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="issued">Issued (Unpaid)</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none"
          >
            <option value="all">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="credit">Credit (Net-30)</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>

      {/* Mobile Invoices Card List (Small Screens) */}
      <div className="md:hidden space-y-3">
        {filteredInvoices.length === 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 text-center text-neutral-500 bg-white dark:bg-neutral-950">
            <div className="text-3xl mb-2">🧾</div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">No invoices found</p>
            <p className="text-xs text-neutral-500 mt-1">Try adjusting search or filters.</p>
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const customerName =
              (inv.customer_details?.name as string) || inv.customer?.name || "Walk-in Customer";
            const companyName =
              (inv.customer_details?.company as string) || inv.customer?.company_name;
            const balanceDue = Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0));

            return (
              <div
                key={inv.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-950 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/billing/${inv.id}`}
                      className="font-mono font-bold text-sm text-neutral-950 dark:text-white flex items-center gap-1 hover:underline"
                    >
                      <span>{inv.invoice_number}</span>
                      <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                    <div className="text-xs text-neutral-500 mt-0.5">{inv.issue_date}</div>
                  </div>
                  <div>{getStatusBadge(inv.status)}</div>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex justify-between items-baseline">
                  <div>
                    <div className="font-semibold text-xs text-neutral-900 dark:text-white">{customerName}</div>
                    {companyName && <div className="text-[10px] text-neutral-500 truncate max-w-[180px]">{companyName}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-neutral-950 dark:text-white">{formatCurrency(inv.total_amount)}</div>
                    <div className="text-[10px] mt-0.5">
                      {balanceDue === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Paid in full</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-mono">Due: {formatCurrency(balanceDue)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between text-xs">
                  <span className="uppercase text-[9px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                    {inv.payment_method?.replace("_", " ") || "other"}
                  </span>

                  <div className="flex items-center gap-2">
                    {inv.status !== "paid" && (
                      <button
                        onClick={() => handleQuickMarkPaid(inv)}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded text-xs font-semibold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                      >
                        Mark Paid
                      </button>
                    )}
                    <Link
                      href={`/billing/${inv.id}`}
                      className="px-2.5 py-1 rounded text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Invoice Table */}
      <div className="hidden md:block border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/75 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 font-medium">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="text-3xl">🧾</div>
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        No invoices found
                      </p>
                      <p className="text-xs text-neutral-500 max-w-sm">
                        {searchQuery || statusFilter !== "all" || paymentFilter !== "all"
                          ? "Try clearing your filters or search terms."
                          : "Create your first invoice to generate sales receipts and manage enterprise accounts."}
                      </p>
                      {invoices.length === 0 && (
                        <div className="pt-3 flex gap-2">
                          <button
                            onClick={handleSeed}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                          >
                            Seed Sample Invoices
                          </button>
                          <Link
                            href="/billing/new"
                            className="px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90"
                          >
                            Create Invoice
                          </Link>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const customerName =
                    (inv.customer_details?.name as string) || inv.customer?.name || "Walk-in Customer";
                  const companyName =
                    (inv.customer_details?.company as string) || inv.customer?.company_name;
                  const balanceDue = Math.max(0, Number(inv.total_amount || 0) - Number(inv.amount_paid || 0));

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-900/40 transition-colors group"
                    >
                      {/* Invoice Number */}
                      <td className="py-3.5 px-4 font-mono font-medium text-neutral-950 dark:text-white">
                        <Link
                          href={`/billing/${inv.id}`}
                          className="hover:underline flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100"
                        >
                          <span>{inv.invoice_number}</span>
                          <svg
                            className="w-3 h-3 text-neutral-400 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {customerName}
                        </div>
                        {companyName && (
                          <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">
                            {companyName}
                          </div>
                        )}
                      </td>

                      {/* Issue Date */}
                      <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        <div>{inv.issue_date}</div>
                        {inv.due_date && (
                          <div className="text-[10px] text-neutral-500">
                            Due: {inv.due_date}
                          </div>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block uppercase tracking-wider text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {inv.payment_method?.replace("_", " ") || "other"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(inv.status)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-medium text-neutral-950 dark:text-white">
                        {formatCurrency(inv.total_amount)}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3.5 px-4 text-right">
                        {balanceDue === 0 ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Paid in Full
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">
                            {formatCurrency(balanceDue)}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/billing/${inv.id}`}
                            className="p-1 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title="View / Print Invoice"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Link>

                          {inv.status !== "paid" && (
                            <button
                              onClick={() => handleQuickMarkPaid(inv)}
                              disabled={isPending}
                              title="Mark as Paid in Full"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(inv.id, inv.invoice_number)}
                            disabled={isPending}
                            title="Delete Invoice"
                            className="p-1 rounded text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
