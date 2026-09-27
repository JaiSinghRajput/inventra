"use client";

import { useState, useTransition } from "react";
import { InventoryItem, MovementType } from "@/types/inventory";
import { recordStockMovement } from "@/lib/db/inventory";
import { useClerkRole } from "@/lib/hooks/use-clerk-role";

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: InventoryItem;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  item,
}: StockAdjustmentModalProps) {
  const { permissions } = useClerkRole();
  const [isPending, startTransition] = useTransition();
  const [movementType, setMovementType] = useState<MovementType>("purchase");
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate stock after
  const isAddition = movementType === "purchase" || movementType === "return";
  const delta = isAddition ? quantity : -quantity;
  const stockBefore = item.stock_quantity;
  const stockAfter = Math.max(0, stockBefore + delta);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!permissions.canAdjustStock) {
      setErrorMessage("Permission Denied: Your role does not allow manual stock adjustments.");
      return;
    }

    if (quantity <= 0) {
      setErrorMessage("Quantity must be greater than zero.");
      return;
    }

    if (!isAddition && quantity > stockBefore) {
      setErrorMessage(
        `Cannot deduct ${quantity} units. Current stock is only ${stockBefore}.`
      );
      return;
    }

    startTransition(async () => {
      try {
        await recordStockMovement({
          item_id: item.id,
          movement_type: movementType,
          quantity_change: delta,
          stock_before: stockBefore,
          stock_after: stockAfter,
          reference_type: movementType === "purchase" ? "purchase_order" : "audit",
          reference_id: referenceId.trim() || null,
          reason: reason.trim() || null,
          metadata: {},
        });

        onSuccess();
        onClose();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to record stock movement."
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-900/40">
          <div>
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <span>Adjust Stock</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {item.sku}
              </span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
              {item.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Current & Future Balance Box */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 text-center font-mono">
            <div>
              <div className="text-[10px] text-neutral-400">Current</div>
              <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                {stockBefore}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className={`text-xs font-bold ${isAddition ? "text-emerald-500" : "text-amber-500"}`}>
                {isAddition ? `+${quantity}` : `-${quantity}`}
              </span>
              <span className="text-[10px] text-neutral-400">&rarr;</span>
            </div>
            <div>
              <div className="text-[10px] text-neutral-400">New Balance</div>
              <div className="text-sm font-bold text-neutral-950 dark:text-white">
                {stockAfter}
              </div>
            </div>
          </div>

          {/* Action Type */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Action / Movement Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMovementType("purchase")}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-left flex items-center justify-between transition-colors ${
                  movementType === "purchase"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                <span>Restock (Purchase)</span>
                <span className="text-emerald-600 font-bold">+</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType("adjustment")}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-left flex items-center justify-between transition-colors ${
                  movementType === "adjustment"
                    ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/20"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                <span>Audit Adjustment</span>
                <span className="text-amber-600 font-bold">+/-</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType("damage")}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-left flex items-center justify-between transition-colors ${
                  movementType === "damage"
                    ? "border-red-500 bg-red-50/60 dark:bg-red-950/20 text-red-800 dark:text-red-300 ring-1 ring-red-500/20"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                <span>Damage / Write-off</span>
                <span className="text-red-600 font-bold">-</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType("return")}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-left flex items-center justify-between transition-colors ${
                  movementType === "return"
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/20"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                <span>Customer Return</span>
                <span className="text-blue-600 font-bold">+</span>
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Quantity ({item.unit || "units"}) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono font-bold text-sm"
            />
          </div>

          {/* Reference ID */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Reference Document (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. PO-9842 or AUDIT-2026"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Audit Reason / Note
            </label>
            <textarea
              rows={2}
              placeholder="Reason for adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isPending && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              <span>Confirm Adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
