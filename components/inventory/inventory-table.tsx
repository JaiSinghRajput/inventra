"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Category, InventoryItem } from "@/types/inventory";
import { deleteInventoryItem, seedSampleInventoryItems } from "@/lib/db/inventory";
import { ProductModal } from "@/components/inventory/product-modal";
import { StockAdjustmentModal } from "@/components/inventory/stock-adjustment-modal";
import { formatCurrency } from "@/lib/currency";
import { useClerkRole } from "@/lib/hooks/use-clerk-role";

interface InventoryTableProps {
  initialItems: InventoryItem[];
  categories: Category[];
}

type SortField = "name" | "sku" | "stock_quantity" | "buy_price" | "sell_price" | "margin" | "created_at";
type SortDirection = "asc" | "desc";

export function InventoryTable({ initialItems, categories }: InventoryTableProps) {
  const { role, permissions } = useClerkRole();
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Sorting State
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;

    for (const item of items) {
      totalStock += item.stock_quantity;
      totalCostValue += item.stock_quantity * item.buy_price;
      totalRetailValue += item.stock_quantity * item.sell_price;

      if (item.stock_quantity === 0) {
        outOfStockCount++;
      } else if (item.stock_quantity <= item.min_stock_alert) {
        lowStockCount++;
      }
    }

    return {
      totalItems: items.length,
      totalStock,
      lowStockCount,
      outOfStockCount,
      totalCostValue,
      totalRetailValue,
    };
  }, [items]);

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return items
      .filter((item) => {
        // Search text matching
        if (q) {
          const matchSku = item.sku.toLowerCase().includes(q);
          const matchName = item.name.toLowerCase().includes(q);
          const matchBarcode = item.barcode ? item.barcode.toLowerCase().includes(q) : false;
          const matchBrand = item.brand ? item.brand.toLowerCase().includes(q) : false;
          if (!matchSku && !matchName && !matchBarcode && !matchBrand) return false;
        }

        // Category filter
        if (selectedCategory !== "all") {
          if (item.category_id !== selectedCategory) return false;
        }

        // Status filter
        if (statusFilter !== "all") {
          if (item.status !== statusFilter) return false;
        }

        // Stock status filter
        if (stockFilter === "out_of_stock") {
          if (item.stock_quantity !== 0) return false;
        } else if (stockFilter === "low_stock") {
          if (item.stock_quantity === 0 || item.stock_quantity > item.min_stock_alert) return false;
        } else if (stockFilter === "in_stock") {
          if (item.stock_quantity <= item.min_stock_alert) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (sortField === "margin") {
          valA = a.sell_price > 0 ? (a.sell_price - a.buy_price) / a.sell_price : 0;
          valB = b.sell_price > 0 ? (b.sell_price - b.buy_price) / b.sell_price : 0;
        } else if (sortField === "name") {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortField === "sku") {
          valA = a.sku.toLowerCase();
          valB = b.sku.toLowerCase();
        } else if (sortField === "stock_quantity") {
          valA = a.stock_quantity;
          valB = b.stock_quantity;
        } else if (sortField === "buy_price") {
          valA = a.buy_price;
          valB = b.buy_price;
        } else if (sortField === "sell_price") {
          valA = a.sell_price;
          valB = b.sell_price;
        } else if (sortField === "created_at") {
          valA = a.created_at || "";
          valB = b.created_at || "";
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [items, searchQuery, selectedCategory, stockFilter, statusFilter, sortField, sortDirection]);

  // Paginated Slices
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Handle Sort Toggle
  const toggleSort = (field: SortField) => {
    if (field === "buy_price" && !permissions.canViewCosts) return;
    if (field === "margin" && !permissions.canViewMargins) return;
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Seed sample data action
  const handleSeedData = () => {
    startTransition(async () => {
      try {
        await seedSampleInventoryItems();
        window.location.reload();
      } catch (err: unknown) {
        alert("Failed to seed demo data: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  // Delete product action
  const handleDelete = (id: string, name: string) => {
    if (!permissions.canDeleteRecords) {
      alert("Permission denied: only organization administrators can delete items.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${name}"? This action is permanent.`)) return;

    startTransition(async () => {
      try {
        await deleteInventoryItem(id);
        setItems((prev) => prev.filter((it) => it.id !== id));
      } catch (err: unknown) {
        alert("Failed to delete product: " + (err instanceof Error ? err.message : String(err)));
      }
    });
  };

  // Export CSV (sanitized against role data leaks)
  const handleExportCSV = () => {
    const headers = [
      "SKU",
      "Barcode",
      "Name",
      "Category",
      "Stock",
      "Min Alert",
      ...(permissions.canViewCosts ? ["Buy Price"] : []),
      "Sell Price",
      ...(permissions.canViewMargins ? ["Margin %"] : []),
      "Status",
      "Location",
    ];

    const rows = filteredItems.map((item) => {
      const margin =
        item.sell_price > 0
          ? (((item.sell_price - item.buy_price) / item.sell_price) * 100).toFixed(1)
          : "0";
      return [
        `"${item.sku}"`,
        `"${item.barcode || ""}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category?.name || "Uncategorized"}"`,
        item.stock_quantity,
        item.min_stock_alert,
        ...(permissions.canViewCosts ? [item.buy_price] : []),
        item.sell_price,
        ...(permissions.canViewMargins ? [`"${margin}%"`] : []),
        `"${item.status}"`,
        `"${item.location || ""}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventra_catalog_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Inventory Catalog
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Manage your product inventory, SKU tracking, stock thresholds, and margins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {permissions.canEditInventory && items.length === 0 && (
            <button
              type="button"
              onClick={handleSeedData}
              disabled={isPending}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>⚡ Load Sample Catalog</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            Export CSV
          </button>

          {permissions.canEditInventory && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Total SKUs</div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {metrics.totalItems}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Total Units in Stock</div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {metrics.totalStock.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Low Stock Alerts</span>
          </div>
          <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
            {metrics.lowStockCount}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>Out of Stock</span>
          </div>
          <div className="text-lg font-bold font-mono text-red-700 dark:text-red-400 mt-1">
            {metrics.outOfStockCount}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Total Retail Value</div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {formatCurrency(metrics.totalRetailValue)}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search by SKU, product name, barcode, brand..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
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

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-48 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white text-xs focus:outline-none"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value as typeof stockFilter);
              setCurrentPage(1);
            }}
            className="w-full sm:w-40 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white text-xs focus:outline-none"
          >
            <option value="all">All Stock Levels</option>
            <option value="in_stock">In Stock (&gt; alert)</option>
            <option value="low_stock">Low Stock (≤ alert)</option>
            <option value="out_of_stock">Out of Stock (0)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-36 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white text-xs focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
      </div>

      {/* Mobile Catalog Card View (Small Screens) */}
      <div className="md:hidden space-y-3">
        {paginatedItems.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-[#101014]">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">No products match your criteria</p>
          </div>
        ) : (
          paginatedItems.map((item) => {
            const isOutOfStock = item.stock_quantity === 0;
            const isLowStock = !isOutOfStock && item.stock_quantity <= item.min_stock_alert;
            const grossProfit = item.sell_price - item.buy_price;
            const marginPercent = item.sell_price > 0 ? ((grossProfit / item.sell_price) * 100).toFixed(1) : "0.0";
            const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];

            return (
              <div
                key={item.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 bg-white dark:bg-[#101014] shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 overflow-hidden shrink-0 flex items-center justify-center">
                    {primaryImage ? (
                      <img src={primaryImage.url} alt={primaryImage.alt || item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-neutral-400">📦</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-semibold text-xs text-neutral-950 dark:text-white truncate">
                        {item.name}
                      </h3>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        isOutOfStock ? "bg-red-500/10 text-red-500" : isLowStock ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                      }`}>
                        {item.stock_quantity} {item.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500 font-mono">
                      <span>SKU: {item.sku}</span>
                      {item.brand && <span>&bull; {item.brand}</span>}
                      {item.category && <span className="text-neutral-400">&bull; {item.category.name}</span>}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase">Sales Price</span>
                    <div className="text-sm font-bold font-mono text-neutral-950 dark:text-white">
                      {formatCurrency(item.sell_price)}
                    </div>
                  </div>

                  {permissions.canViewCosts && (
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 uppercase">Cost / Margin</span>
                      <div className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                        {formatCurrency(item.buy_price)}{" "}
                        {permissions.canViewMargins && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ({marginPercent}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between gap-2">
                  <Link
                    href={`/inventory/${item.id}/movements`}
                    className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white underline"
                  >
                    Ledger
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {permissions.canAdjustStock && (
                      <button
                        type="button"
                        onClick={() => setAdjustingItem(item)}
                        className="px-2.5 py-1 rounded text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 transition-colors"
                      >
                        Adjust
                      </button>
                    )}
                    {permissions.canEditInventory && (
                      <button
                        type="button"
                        onClick={() => setEditingItem(item)}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-opacity"
                      >
                        Edit
                      </button>
                    )}
                    {permissions.canDeleteRecords && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.name)}
                        className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
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

      {/* Enterprise Data Table (Desktop) */}
      <div className="hidden md:block border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-[#101014] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 font-mono select-none">
                <th className="py-2.5 px-3 w-12 text-center">Item</th>
                <th
                  onClick={() => toggleSort("name")}
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Product & SKU</span>
                    {sortField === "name" && (sortDirection === "asc" ? "▲" : "▼")}
                  </div>
                </th>
                <th className="py-2.5 px-3 font-medium">Category</th>
                <th
                  onClick={() => toggleSort("stock_quantity")}
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-neutral-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Stock Level</span>
                    {sortField === "stock_quantity" && (sortDirection === "asc" ? "▲" : "▼")}
                  </div>
                </th>
                {permissions.canViewCosts && (
                  <th
                    onClick={() => toggleSort("buy_price")}
                    className="py-2.5 px-3 font-medium cursor-pointer hover:text-neutral-950 dark:hover:text-white text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Cost (₹)</span>
                      {sortField === "buy_price" && (sortDirection === "asc" ? "▲" : "▼")}
                    </div>
                  </th>
                )}
                <th
                  onClick={() => toggleSort("sell_price")}
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-neutral-950 dark:hover:text-white text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Sales Price (₹)</span>
                    {sortField === "sell_price" && (sortDirection === "asc" ? "▲" : "▼")}
                  </div>
                </th>
                {permissions.canViewMargins && (
                  <th
                    onClick={() => toggleSort("margin")}
                    className="py-2.5 px-3 font-medium cursor-pointer hover:text-neutral-950 dark:hover:text-white text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Margin</span>
                      {sortField === "margin" && (sortDirection === "asc" ? "▲" : "▼")}
                    </div>
                  </th>
                )}
                <th className="py-2.5 px-3 font-medium">Specs</th>
                <th className="py-2.5 px-3 font-medium text-right pr-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
              {paginatedItems.map((item) => {
                // Stock indicators
                const isOutOfStock = item.stock_quantity === 0;
                const isLowStock = !isOutOfStock && item.stock_quantity <= item.min_stock_alert;

                // Profit Margin
                const grossProfit = item.sell_price - item.buy_price;
                const marginPercent =
                  item.sell_price > 0 ? ((grossProfit / item.sell_price) * 100).toFixed(1) : "0.0";
                const isHealthyMargin = Number(marginPercent) >= 20;

                // Primary Image
                const primaryImage =
                  item.images?.find((img) => img.is_primary) || item.images?.[0];

                // Specifications count
                const specsCount = item.features ? Object.keys(item.features).length : 0;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="w-8 h-8 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center mx-auto text-neutral-400">
                        {primaryImage?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={primaryImage.url}
                            alt={primaryImage.alt || item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://placehold.co/100x100/18181b/ffffff?text=Item";
                            }}
                          />
                        ) : (
                          <span className="text-[10px] font-mono">📦</span>
                        )}
                      </div>
                    </td>

                    {/* Product Name & SKU */}
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/inventory/${item.id}/movements`}
                        className="font-medium text-neutral-950 dark:text-white line-clamp-1 hover:underline decoration-neutral-400"
                        title="View Historical Stock Ledger"
                      >
                        {item.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-neutral-500">
                        <Link
                          href={`/inventory/${item.id}/movements`}
                          className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                          title="View Audit Ledger"
                        >
                          {item.sku}
                        </Link>
                        {item.brand && <span>&bull; {item.brand}</span>}
                        {item.barcode && (
                          <span className="text-neutral-400 hidden sm:inline">[{item.barcode}]</span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900">
                        {item.category?.name || "Uncategorized"}
                      </span>
                    </td>

                    {/* Stock Indicator */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOutOfStock
                              ? "bg-red-500 animate-pulse"
                              : isLowStock
                              ? "bg-amber-500 animate-pulse"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                          {item.stock_quantity}
                        </span>
                        <span className="text-[10px] text-neutral-400">{item.unit || "pcs"}</span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                        {isOutOfStock ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            Out of stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            Low (Alert: {item.min_stock_alert})
                          </span>
                        ) : (
                          <span>Min: {item.min_stock_alert}</span>
                        )}
                        {item.location && <span className="hidden md:inline"> &bull; {item.location}</span>}
                      </div>
                    </td>

                    {/* Cost / Buy Price - Only visible if permitted */}
                    {permissions.canViewCosts && (
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {formatCurrency(item.buy_price)}
                      </td>
                    )}

                    {/* Sales Price */}
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-950 dark:text-white">
                      {formatCurrency(item.sell_price)}
                    </td>

                    {/* Margin - Only visible if permitted */}
                    {permissions.canViewMargins && (
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            isHealthyMargin
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          +{marginPercent}%
                        </span>
                      </td>
                    )}

                    {/* Specs / Features JSONB */}
                    <td className="py-2.5 px-3">
                      {specsCount > 0 ? (
                        <div
                          className="text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 cursor-pointer"
                          title={JSON.stringify(item.features, null, 2)}
                          onClick={() => permissions.canEditInventory && setEditingItem(item)}
                        >
                          <span className="underline decoration-dotted">{specsCount} attributes</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                        {/* Audit Ledger */}
                        <Link
                          href={`/inventory/${item.id}/movements`}
                          title="View Historical Audit Ledger"
                          className="px-2 py-1 rounded text-[11px] font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                        >
                          Ledger
                        </Link>

                        {/* Adjust Stock */}
                        {permissions.canAdjustStock && (
                          <button
                            type="button"
                            onClick={() => setAdjustingItem(item)}
                            title="Quick Stock Adjustment"
                            className="px-2 py-1 rounded text-[11px] font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                          >
                            Adjust
                          </button>
                        )}

                        {/* Edit Product */}
                        {permissions.canEditInventory && (
                          <button
                            type="button"
                            onClick={() => setEditingItem(item)}
                            title="Edit Product"
                            className="px-2 py-1 rounded text-[11px] font-medium border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                          >
                            Edit
                          </button>
                        )}

                        {/* Delete */}
                        {permissions.canDeleteRecords && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Delete Product"
                            className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + (permissions.canViewCosts ? 1 : 0) + (permissions.canViewMargins ? 1 : 0)}
                    className="py-12 text-center text-neutral-400"
                  >
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="text-2xl">📦</div>
                      <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        No inventory products found
                      </div>
                      <p className="text-xs text-neutral-500">
                        {searchQuery || selectedCategory !== "all" || stockFilter !== "all"
                          ? "Try clearing filters to see more products."
                          : "Your catalog is empty. Create your first product or load sample data."}
                      </p>
                      {items.length === 0 && (
                        <div className="pt-2 flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleSeedData}
                            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium cursor-pointer"
                          >
                            Load Sample Catalog
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium cursor-pointer"
                          >
                            + Add Product
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

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 flex items-center justify-between text-xs text-neutral-500 font-mono">
            <div>
              Showing{" "}
              <span className="font-semibold text-neutral-900 dark:text-white">
                {Math.min(filteredItems.length, (currentPage - 1) * pageSize + 1)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-neutral-900 dark:text-white">
                {Math.min(filteredItems.length, currentPage * pageSize)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-neutral-900 dark:text-white">
                {filteredItems.length}
              </span>{" "}
              products
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
                >
                  &larr; Prev
                </button>
                <span className="px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Creation Modal */}
      {isCreateModalOpen && (
        <ProductModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => window.location.reload()}
          categories={categories}
        />
      )}

      {/* Product Edit Modal */}
      {editingItem && (
        <ProductModal
          isOpen={!!editingItem}
          initialData={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => window.location.reload()}
          categories={categories}
        />
      )}

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <StockAdjustmentModal
          isOpen={!!adjustingItem}
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
