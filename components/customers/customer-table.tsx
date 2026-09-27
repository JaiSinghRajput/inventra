"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Customer } from "@/types/billing";
import { deleteCustomer, seedSampleCustomers } from "@/lib/db/billing";
import { CustomerModal } from "@/components/customers/customer-modal";
import { useClerkRole } from "@/lib/hooks/use-clerk-role";

interface CustomerTableProps {
  initialCustomers: Customer[];
}

export function CustomerTable({ initialCustomers }: CustomerTableProps) {
  const { permissions } = useClerkRole();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<"all" | "business" | "individual">("all");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Metrics
  const metrics = useMemo(() => {
    let businessCount = 0;
    let individualCount = 0;

    for (const c of customers) {
      if (c.company_name || c.tax_id) {
        businessCount++;
      } else {
        individualCount++;
      }
    }

    return {
      total: customers.length,
      businessCount,
      individualCount,
    };
  }, [customers]);

  // Filtered
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return customers.filter((c) => {
      if (q) {
        const matchName = c.name.toLowerCase().includes(q);
        const matchCompany = c.company_name ? c.company_name.toLowerCase().includes(q) : false;
        const matchEmail = c.email ? c.email.toLowerCase().includes(q) : false;
        const matchPhone = c.phone ? c.phone.toLowerCase().includes(q) : false;
        const matchTax = c.tax_id ? c.tax_id.toLowerCase().includes(q) : false;
        if (!matchName && !matchCompany && !matchEmail && !matchPhone && !matchTax) {
          return false;
        }
      }

      if (accountTypeFilter === "business") {
        if (!c.company_name && !c.tax_id) return false;
      } else if (accountTypeFilter === "individual") {
        if (c.company_name || c.tax_id) return false;
      }

      return true;
    });
  }, [customers, searchQuery, accountTypeFilter]);

  const handleSeed = () => {
    startTransition(async () => {
      try {
        await seedSampleCustomers();
        window.location.reload();
      } catch (err: unknown) {
        alert("Failed to seed sample customers: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!permissions.canDeleteRecords) {
      alert("Permission denied: Only organization administrators can delete customer records.");
      return;
    }
    if (!confirm(`Are you sure you want to delete customer "${name}"?`)) return;

    startTransition(async () => {
      try {
        await deleteCustomer(id);
        setCustomers((prev) => prev.filter((c) => c.id !== id));
      } catch (err: unknown) {
        alert("Failed to delete customer: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Company", "Email", "Phone", "Tax ID", "City", "Country", "Notes"];
    const rows = filteredCustomers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.company_name || "").replace(/"/g, '""')}"`,
      `"${c.email || ""}"`,
      `"${c.phone || ""}"`,
      `"${c.tax_id || ""}"`,
      `"${c.billing_address?.city || ""}"`,
      `"${c.billing_address?.country || ""}"`,
      `"${(c.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.join("\n")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventra_customers_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Customer & Client Directory
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Manage business accounts, tax IDs (GSTIN/VAT), structured addresses, and purchase history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {customers.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={isPending}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>⚡ Load Sample Clients</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredCustomers.length === 0}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <span>+ Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Total Customer Accounts
          </div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {metrics.total}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
            Corporate / B2B Accounts
          </div>
          <div className="text-lg font-bold font-mono text-blue-700 dark:text-blue-400 mt-1">
            {metrics.businessCount}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Individual Clients
          </div>
          <div className="text-lg font-bold font-mono text-neutral-800 dark:text-neutral-200 mt-1">
            {metrics.individualCount}
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by customer name, company, email, phone, or Tax ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
            🔍
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={accountTypeFilter}
          onChange={(e) => setAccountTypeFilter(e.target.value as typeof accountTypeFilter)}
          className="w-full sm:w-48 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white text-xs focus:outline-none"
        >
          <option value="all">All Account Types</option>
          <option value="business">Corporate / B2B Only</option>
          <option value="individual">Individuals Only</option>
        </select>
      </div>

      {/* Mobile Customer Cards (Small Screens) */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-[#101014]">
            <div className="text-3xl mb-2">👥</div>
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">No customers found</p>
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const city = cust.billing_address?.city;
            const country = cust.billing_address?.country;
            const locationStr = [city, country].filter(Boolean).join(", ");

            return (
              <div
                key={cust.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 bg-white dark:bg-[#101014] shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/customers/${cust.id}`}
                      className="font-semibold text-sm text-neutral-950 dark:text-white hover:underline"
                    >
                      {cust.name}
                    </Link>
                    {cust.company_name && (
                      <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{cust.company_name}</div>
                    )}
                  </div>
                  {cust.tax_id && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {cust.tax_id}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 text-xs space-y-1 text-neutral-600 dark:text-neutral-400">
                  {cust.email && <div>✉ {cust.email}</div>}
                  {cust.phone && <div>📞 {cust.phone}</div>}
                  {locationStr && <div className="text-[11px] text-neutral-500">📍 {locationStr}</div>}
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between">
                  <Link
                    href={`/billing/new?customer_id=${cust.id}`}
                    className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline"
                  >
                    + Create Invoice
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/customers/${cust.id}`}
                      className="px-2.5 py-1 rounded text-xs font-medium border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingCustomer(cust)}
                      className="px-2.5 py-1 rounded text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90"
                    >
                      Edit
                    </button>
                    {permissions.canDeleteRecords && (
                      <button
                        type="button"
                        onClick={() => handleDelete(cust.id, cust.name)}
                        className="p-1 rounded text-neutral-400 hover:text-red-500"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-[#101014] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 font-mono select-none">
                <th className="py-2.5 px-3.5 font-medium">Customer / Company</th>
                <th className="py-2.5 px-3 font-medium">Contact Details</th>
                <th className="py-2.5 px-3 font-medium">Tax ID / GSTIN</th>
                <th className="py-2.5 px-3 font-medium">Location</th>
                <th className="py-2.5 px-3 font-medium text-right pr-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
              {filteredCustomers.map((cust) => {
                const city = cust.billing_address?.city;
                const country = cust.billing_address?.country;
                const locationStr = [city, country].filter(Boolean).join(", ");

                return (
                  <tr
                    key={cust.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors group"
                  >
                    {/* Customer & Company */}
                    <td className="py-2.5 px-3.5">
                      <Link
                        href={`/customers/${cust.id}`}
                        className="font-medium text-neutral-950 dark:text-white hover:underline decoration-neutral-400"
                        title="View Profile & Purchase History"
                      >
                        {cust.name}
                      </Link>
                      {cust.company_name ? (
                        <div className="text-[11px] text-neutral-500 line-clamp-1 font-mono">
                          {cust.company_name}
                        </div>
                      ) : (
                        <div className="text-[10px] text-neutral-400 font-mono">Individual Account</div>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-neutral-700 dark:text-neutral-300">
                        {cust.email || <span className="text-neutral-400">—</span>}
                      </div>
                      <div className="text-[11px] font-mono text-neutral-500 mt-0.5">
                        {cust.phone || ""}
                      </div>
                    </td>

                    {/* Tax ID */}
                    <td className="py-2.5 px-3 font-mono">
                      {cust.tax_id ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                          {cust.tax_id}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                      {locationStr || <span className="text-neutral-400 font-mono">—</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                        <Link
                          href={`/customers/${cust.id}`}
                          title="View Profile & Invoices"
                          className="px-2 py-1 rounded text-[11px] font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                        >
                          Profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEditingCustomer(cust)}
                          title="Edit Customer"
                          className="px-2 py-1 rounded text-[11px] font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        {permissions.canDeleteRecords && (
                          <button
                            type="button"
                            onClick={() => handleDelete(cust.id, cust.name)}
                            title="Delete Customer"
                            className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-neutral-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="text-2xl">👥</div>
                      <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        No customer accounts found
                      </div>
                      <p className="text-xs text-neutral-500">
                        {searchQuery
                          ? "Try a different search term."
                          : "Your customer directory is empty. Add your first customer or load sample accounts."}
                      </p>
                      {customers.length === 0 && (
                        <div className="pt-2 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleSeed}
                            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium cursor-pointer"
                          >
                            Load Sample Clients
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium cursor-pointer"
                          >
                            + Add Customer
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CustomerModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {editingCustomer && (
        <CustomerModal
          isOpen={!!editingCustomer}
          initialData={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
