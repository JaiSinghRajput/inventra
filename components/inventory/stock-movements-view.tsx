"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { InventoryItem, MovementType, StockMovement } from "@/types/inventory";
import { StockAdjustmentModal } from "@/components/inventory/stock-adjustment-modal";

interface StockMovementsViewProps {
  item: InventoryItem;
  movements: StockMovement[];
}

export function StockMovementsView({ item, movements: initialMovements }: StockMovementsViewProps) {
  const [movements] = useState<StockMovement[]>(initialMovements);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Ledger Summary Analytics
  const summary = useMemo(() => {
    let totalPurchased = 0;
    let totalSold = 0;
    let totalAdjusted = 0;
    let totalDamaged = 0;

    for (const m of movements) {
      if (m.movement_type === "purchase") totalPurchased += m.quantity_change;
      if (m.movement_type === "sale") totalSold += Math.abs(m.quantity_change);
      if (m.movement_type === "damage") totalDamaged += Math.abs(m.quantity_change);
      if (m.movement_type === "adjustment") totalAdjusted += m.quantity_change;
    }

    return {
      totalMovements: movements.length,
      totalPurchased,
      totalSold,
      totalAdjusted,
      totalDamaged,
    };
  }, [movements]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return movements.filter((m) => {
      if (typeFilter !== "all" && m.movement_type !== typeFilter) {
        return false;
      }

      if (q) {
        const matchRef = m.reference_id ? m.reference_id.toLowerCase().includes(q) : false;
        const matchReason = m.reason ? m.reason.toLowerCase().includes(q) : false;
        const matchOperator = m.performed_by ? m.performed_by.toLowerCase().includes(q) : false;
        if (!matchRef && !matchReason && !matchOperator) return false;
      }

      return true;
    });
  }, [movements, typeFilter, searchQuery]);

  // Stock status
  const isOutOfStock = item.stock_quantity === 0;
  const isLowStock = !isOutOfStock && item.stock_quantity <= item.min_stock_alert;

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case "purchase":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            <span>+</span> Restock (Purchase)
          </span>
        );
      case "sale":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
            <span>-</span> Invoice Sale
          </span>
        );
      case "adjustment":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            <span>±</span> Reconciliation
          </span>
        );
      case "damage":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
            <span>-</span> Write-off / Damage
          </span>
        );
      case "return":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800">
            <span>+</span> Customer Return
          </span>
        );
      case "transfer":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-100 text-neutral-700 border border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
            <span>⇄</span> Location Transfer
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-100 dark:bg-neutral-800">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/inventory"
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            &larr; Inventory Catalog
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span className="font-mono text-neutral-500">{item.sku}</span>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span className="font-semibold text-neutral-900 dark:text-white">Audit Ledger</span>
        </div>

        <button
          type="button"
          onClick={() => setIsAdjustModalOpen(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
        >
          <span>± Record Stock Movement</span>
        </button>
      </div>

      {/* Product Overview Header Card */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 bg-white dark:bg-[#121215] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-neutral-950 dark:text-white">
                {item.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                {item.sku}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 font-mono">
              {item.brand && <span>Brand: {item.brand}</span>}
              {item.barcode && <span>Barcode: {item.barcode}</span>}
              {item.category && <span>Category: {item.category.name}</span>}
              {item.location && <span>Location: {item.location}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40">
            <div>
              <div className="text-[10px] text-neutral-400 font-mono">CURRENT STOCK</div>
              <div className="text-xl font-bold font-mono text-neutral-950 dark:text-white flex items-center gap-2">
                <span>{item.stock_quantity}</span>
                <span className="text-xs font-normal text-neutral-500">{item.unit || "pcs"}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />

            <div>
              <div className="text-[10px] text-neutral-400 font-mono">STATUS</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOutOfStock
                      ? "bg-red-500"
                      : isLowStock
                      ? "bg-amber-500 animate-pulse"
                      : "bg-emerald-500"
                  }`}
                />
                <span className="text-xs font-semibold capitalize text-neutral-800 dark:text-neutral-200">
                  {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Total Movements
          </div>
          <div className="text-lg font-bold font-mono text-neutral-950 dark:text-white mt-1">
            {summary.totalMovements}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Units Restocked (+)
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            +{summary.totalPurchased}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
            Units Sold (-)
          </div>
          <div className="text-lg font-bold font-mono text-blue-700 dark:text-blue-400 mt-1">
            -{summary.totalSold}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40">
          <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
            Damaged / Discarded
          </div>
          <div className="text-lg font-bold font-mono text-red-700 dark:text-red-400 mt-1">
            -{summary.totalDamaged}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <input
            type="text"
            placeholder="Search by reference document, reason, operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-neutral-500 text-xs">Movement Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white font-mono"
          >
            <option value="all">All Movements</option>
            <option value="purchase">Purchase (Restock)</option>
            <option value="sale">Invoice Sale</option>
            <option value="adjustment">Audit Adjustment</option>
            <option value="damage">Damage / Write-off</option>
            <option value="return">Customer Return</option>
          </select>
        </div>
      </div>

      {/* Immutable Audit Ledger Table */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-[#101014] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 font-mono select-none">
                <th className="py-2.5 px-3.5 font-medium">Timestamp</th>
                <th className="py-2.5 px-3 font-medium">Type</th>
                <th className="py-2.5 px-3 font-medium text-right">Change</th>
                <th className="py-2.5 px-3.5 font-medium text-center">Stock Shift</th>
                <th className="py-2.5 px-3 font-medium">Reference Doc</th>
                <th className="py-2.5 px-3 font-medium">Audit Reason / Notes</th>
                <th className="py-2.5 px-3.5 font-medium text-right pr-4">Operator</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
              {filteredMovements.map((movement) => {
                const isPositive = movement.quantity_change > 0;
                const formattedDate = movement.created_at
                  ? new Date(movement.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";

                return (
                  <tr
                    key={movement.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {formattedDate}
                    </td>

                    {/* Movement Type */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getMovementBadge(movement.movement_type)}
                    </td>

                    {/* Quantity Change */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {isPositive ? `+${movement.quantity_change}` : movement.quantity_change}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-normal ml-1">
                        {item.unit || "pcs"}
                      </span>
                    </td>

                    {/* Stock Shift (Before -> After) */}
                    <td className="py-2.5 px-3.5 text-center font-mono whitespace-nowrap">
                      <span className="text-neutral-500">{movement.stock_before}</span>
                      <span className="text-neutral-400 mx-1.5">&rarr;</span>
                      <span className="font-semibold text-neutral-950 dark:text-white">
                        {movement.stock_after}
                      </span>
                    </td>

                    {/* Reference Document */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                      {movement.reference_id ? (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {movement.reference_id}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300 max-w-xs truncate">
                      {movement.reason || <span className="text-neutral-400 font-mono">—</span>}
                    </td>

                    {/* Operator */}
                    <td className="py-2.5 px-3.5 text-right pr-4 font-mono text-[11px] text-neutral-500 max-w-[140px] truncate" title={movement.performed_by || "System"}>
                      {movement.performed_by || "System"}
                    </td>
                  </tr>
                );
              })}

              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="text-2xl">📋</div>
                      <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        No movement entries found
                      </div>
                      <p className="text-xs text-neutral-500">
                        {searchQuery || typeFilter !== "all"
                          ? "Try clearing filters to view all entries."
                          : "No stock movements have been recorded yet for this product."}
                      </p>
                      {movements.length === 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setIsAdjustModalOpen(true)}
                            className="px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-medium cursor-pointer"
                          >
                            + Record First Movement
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

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <StockAdjustmentModal
          isOpen={isAdjustModalOpen}
          item={item}
          onClose={() => setIsAdjustModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
