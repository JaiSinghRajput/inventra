"use client";

import { useState, useTransition } from "react";
import { Category, InventoryImage, InventoryItem, InventoryItemStatus } from "@/types/inventory";
import { insertInventoryItem, updateInventoryItem, createCategory } from "@/lib/db/inventory";
import { useClerkRole } from "@/lib/hooks/use-clerk-role";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  initialData?: InventoryItem | null;
}

const PRESET_FEATURE_KEYS = [
  "Color",
  "Size",
  "Material",
  "Warranty",
  "Weight",
  "Dimensions",
  "Connectivity",
  "Expiry Date",
];

const PRESET_DEMO_IMAGES = [
  {
    label: "Electronics / Peripheral",
    url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Display / Monitor",
    url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Ergonomic Chair",
    url: "https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=600&q=80",
  },
  {
    label: "Industrial Equipment",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
  },
];

export function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  categories: initialCategories,
  initialData,
}: ProductModalProps) {
  const { permissions } = useClerkRole();
  const isEditing = !!initialData;
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Categories list (can be dynamically appended if new category added)
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Core Form Fields
  const [sku, setSku] = useState(initialData?.sku || "");
  const [barcode, setBarcode] = useState(initialData?.barcode || "");
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [brand, setBrand] = useState(initialData?.brand || "");
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [unit, setUnit] = useState(initialData?.unit || "pcs");
  const [status, setStatus] = useState<InventoryItemStatus>(initialData?.status || "active");

  // Pricing & Stock
  const [buyPrice, setBuyPrice] = useState<number>(initialData?.buy_price ?? 0);
  const [sellPrice, setSellPrice] = useState<number>(initialData?.sell_price ?? 0);
  const [taxRate, setTaxRate] = useState<number>(initialData?.tax_rate ?? 0);
  const [stockQuantity, setStockQuantity] = useState<number>(initialData?.stock_quantity ?? 0);
  const [minStockAlert, setMinStockAlert] = useState<number>(initialData?.min_stock_alert ?? 5);
  const [maxStockCapacity, setMaxStockCapacity] = useState<number | string>(
    initialData?.max_stock_capacity ?? ""
  );
  const [location, setLocation] = useState(initialData?.location || "");

  // Dynamic Specifications (features JSONB)
  const [featureRows, setFeatureRows] = useState<Array<{ key: string; value: string }>>(() => {
    if (initialData?.features && Object.keys(initialData.features).length > 0) {
      return Object.entries(initialData.features).map(([k, v]) => ({
        key: k,
        value: typeof v === "string" ? v : JSON.stringify(v),
      }));
    }
    return [
      { key: "Color", value: "" },
      { key: "Material", value: "" },
    ];
  });

  // Images Gallery
  const [images, setImages] = useState<InventoryImage[]>(
    initialData?.images && initialData.images.length > 0
      ? initialData.images
      : []
  );
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");

  if (!isOpen) return null;

  // Real-time Margin Calculation
  const grossProfit = sellPrice - buyPrice;
  const grossMarginPercent =
    sellPrice > 0 ? ((grossProfit / sellPrice) * 100).toFixed(1) : "0.0";
  const isHealthyMargin = Number(grossMarginPercent) >= 20;

  // Auto generators
  const generateSku = () => {
    const prefix = name ? name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "ITM") : "INV";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setSku(`${prefix}-${rand}`);
  };

  const generateBarcode = () => {
    const rand = "890" + Math.floor(1000000000 + Math.random() * 9000000000);
    setBarcode(rand);
  };

  // Add / Remove Dynamic Features
  const addFeatureRow = (prefillKey?: string) => {
    setFeatureRows((prev) => [...prev, { key: prefillKey || "", value: "" }]);
  };

  const updateFeatureRow = (index: number, field: "key" | "value", val: string) => {
    setFeatureRows((prev) => {
      const copy = [...prev];
      copy[index][field] = val;
      return copy;
    });
  };

  const removeFeatureRow = (index: number) => {
    setFeatureRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Image Management
  const addImage = () => {
    if (!newImageUrl.trim()) return;
    const isFirst = images.length === 0;
    setImages((prev) => [
      ...prev,
      {
        url: newImageUrl.trim(),
        alt: newImageAlt.trim() || name || "Product image",
        is_primary: isFirst,
      },
    ]);
    setNewImageUrl("");
    setNewImageAlt("");
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        is_primary: i === index,
      }))
    );
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((img) => img.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  // Handle Create Category Inline
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const slug = newCatName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const created = await createCategory({
        name: newCatName.trim(),
        slug,
      });
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCatName("");
      setIsAddingCategory(false);
    } catch (err: unknown) {
      alert("Failed to create category: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!sku.trim()) {
      setErrorMessage("SKU is required.");
      return;
    }
    if (!name.trim()) {
      setErrorMessage("Product name is required.");
      return;
    }

    // Build features JSONB object
    const featuresPayload: Record<string, string> = {};
    for (const row of featureRows) {
      if (row.key.trim()) {
        featuresPayload[row.key.trim()] = row.value.trim();
      }
    }

    startTransition(async () => {
      try {
        if (isEditing && initialData) {
          await updateInventoryItem(initialData.id, {
            sku: sku.trim(),
            barcode: barcode.trim() || null,
            name: name.trim(),
            description: description.trim() || null,
            category_id: categoryId || null,
            brand: brand.trim() || null,
            unit: unit.trim() || "pcs",
            buy_price: Number(buyPrice) || 0,
            sell_price: Number(sellPrice) || 0,
            tax_rate: Number(taxRate) || 0,
            stock_quantity: Number(stockQuantity) || 0,
            min_stock_alert: Number(minStockAlert) || 5,
            max_stock_capacity: maxStockCapacity === "" ? null : Number(maxStockCapacity),
            location: location.trim() || null,
            status,
            images,
            features: featuresPayload,
          });
        } else {
          await insertInventoryItem({
            sku: sku.trim(),
            barcode: barcode.trim() || null,
            name: name.trim(),
            description: description.trim() || null,
            category_id: categoryId || null,
            brand: brand.trim() || null,
            unit: unit.trim() || "pcs",
            buy_price: Number(buyPrice) || 0,
            sell_price: Number(sellPrice) || 0,
            tax_rate: Number(taxRate) || 0,
            stock_quantity: Number(stockQuantity) || 0,
            min_stock_alert: Number(minStockAlert) || 5,
            max_stock_capacity: maxStockCapacity === "" ? null : Number(maxStockCapacity),
            location: location.trim() || null,
            status,
            images,
            features: featuresPayload,
            metadata: {},
          });
        }

        onSuccess();
        onClose();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "An unexpected error occurred while saving."
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-900/40">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <span>{isEditing ? "Edit Product" : "Create New Product"}</span>
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {isEditing ? initialData.sku : "Catalog Item"}
              </span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Scoped to active tenant organization with real-time margins and JSONB dynamic features.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Section 1: Identification & General Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
              1. Product Identification & Classification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-neutral-700 dark:text-neutral-300">
                    SKU (Item Code) *
                  </label>
                  <button
                    type="button"
                    onClick={generateSku}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. ELEC-KB-001"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-neutral-700 dark:text-neutral-300">
                    Barcode / EAN
                  </label>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="e.g. 890123456789"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InventoryItemStatus)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                >
                  <option value="active">Active (Available)</option>
                  <option value="inactive">Inactive</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nova Wireless Mechanical Keyboard"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. KeyPulse"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-neutral-700 dark:text-neutral-300">
                    Category
                  </label>
                  {!isAddingCategory && (
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(true)}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + New Category
                    </button>
                  )}
                </div>
                {isAddingCategory ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded font-medium text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(false)}
                      className="px-2 py-1 text-neutral-500 hover:text-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-950 dark:focus:ring-white"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Unit of Measure
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pcs, kg, box, meter"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product overview, features, and specs..."
                className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 2: Pricing & Auto-Calculated Margins */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                2. Pricing & Financial Margins
              </h3>
              {permissions.canViewMargins ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-500">Gross Margin:</span>
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                      isHealthyMargin
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                    }`}
                  >
                    {grossMarginPercent}% (₹{grossProfit.toFixed(2)}/unit profit)
                  </span>
                </div>
              ) : (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  🔒 Margin Restricted
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Cost / Buy Price (₹)
                </label>
                {permissions.canViewCosts ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                  />
                ) : (
                  <div className="w-full px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-400 font-mono text-xs select-none">
                    •••• (Masked)
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Retail / Sell Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Gross Profit / Unit
                </label>
                <div className="w-full px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-neutral-700 dark:text-neutral-300">
                  ₹{grossProfit.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 3: Stock Levels & Alert Thresholds */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
              3. Inventory Stock & Alert Thresholds
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Current Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Min Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-neutral-400">Triggers Low Stock badge</span>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Max Capacity (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxStockCapacity}
                  onChange={(e) => setMaxStockCapacity(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Warehouse Location / Aisle
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Warehouse A, Bin 3"
                  className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 4: Dynamic Specifications Builder (features JSONB) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                  4. Dynamic Specifications Builder (features JSONB)
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Arbitrary attributes saved directly in PostgreSQL JSONB with GIN indexing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => addFeatureRow()}
                className="text-xs font-medium px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
              >
                + Add Attribute
              </button>
            </div>

            {/* Quick attribute suggestion tags */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-400">Suggestions:</span>
              {PRESET_FEATURE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => addFeatureRow(key)}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                >
                  +{key}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {featureRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Attribute Name (e.g. Color)"
                    value={row.key}
                    onChange={(e) => updateFeatureRow(idx, "key", e.target.value)}
                    className="w-1/3 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-medium"
                  />
                  <input
                    type="text"
                    placeholder="Attribute Value (e.g. Matte Black)"
                    value={row.value}
                    onChange={(e) => updateFeatureRow(idx, "value", e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeFeatureRow(idx)}
                    className="p-1.5 text-neutral-400 hover:text-red-500 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Remove specification"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {featureRows.length === 0 && (
                <div className="text-center py-3 text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-md">
                  No dynamic specifications added. Click above to add specs.
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Section 5: Image Gallery (Multi-Image + Primary Thumbnail) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                  5. Product Gallery & Thumbnails
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Multiple image URLs with primary thumbnail designation.
                </p>
              </div>
            </div>

            {/* Quick Demo Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-400">Quick Presets:</span>
              {PRESET_DEMO_IMAGES.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setImages((prev) => [
                      ...prev,
                      {
                        url: preset.url,
                        alt: preset.label,
                        is_primary: prev.length === 0,
                      },
                    ]);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                >
                  +{preset.label}
                </button>
              ))}
            </div>

            {/* Image input bar */}
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Image URL (https://...)"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
              />
              <input
                type="text"
                placeholder="Alt description"
                value={newImageAlt}
                onChange={(e) => setNewImageAlt(e.target.value)}
                className="w-1/3 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
              <button
                type="button"
                onClick={addImage}
                className="px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium cursor-pointer"
              >
                Add Image
              </button>
            </div>

            {/* Gallery Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`relative group rounded-lg overflow-hidden border p-1 bg-neutral-50 dark:bg-neutral-900 ${
                      img.is_primary
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <div className="aspect-square w-full rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.alt || name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://placehold.co/400x400/18181b/ffffff?text=Image+Error";
                        }}
                      />
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-600 text-white shadow">
                          PRIMARY
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      {!img.is_primary ? (
                        <button
                          type="button"
                          onClick={() => setPrimaryImage(i)}
                          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                        >
                          Make Primary
                        </button>
                      ) : (
                        <span className="text-blue-500 font-semibold">Thumbnail</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-[#121215] py-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !permissions.canEditInventory}
              title={!permissions.canEditInventory ? "Only Admin and Manager can modify products" : undefined}
              className="px-5 py-2 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isPending && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              <span>{isEditing ? "Save Changes" : "Create Product"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
