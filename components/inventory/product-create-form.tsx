"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Category, InventoryImage, InventoryItemStatus } from "@/types/inventory";
import { insertInventoryItem, createCategory } from "@/lib/db/inventory";

interface ProductCreateFormProps {
  categories: Category[];
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

export function ProductCreateForm({ categories: initialCategories }: ProductCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Categories
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Core Form Fields
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [status, setStatus] = useState<InventoryItemStatus>("active");

  // Pricing & Stock
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(0);
  const [minStockAlert, setMinStockAlert] = useState<number>(5);
  const [maxStockCapacity, setMaxStockCapacity] = useState<string>("");
  const [location, setLocation] = useState("");

  // Dynamic Specifications
  const [featureRows, setFeatureRows] = useState<Array<{ key: string; value: string }>>([
    { key: "Color", value: "" },
    { key: "Material", value: "" },
  ]);

  // Images Gallery
  const [images, setImages] = useState<InventoryImage[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");

  // Real-time Margin Calculation
  const grossProfit = sellPrice - buyPrice;
  const grossMarginPercent =
    sellPrice > 0 ? ((grossProfit / sellPrice) * 100).toFixed(1) : "0.0";
  const isHealthyMargin = Number(grossMarginPercent) >= 20;

  // Auto-generators
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

  // Images
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

  // Create Category Inline
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

    const featuresPayload: Record<string, string> = {};
    for (const row of featureRows) {
      if (row.key.trim()) {
        featuresPayload[row.key.trim()] = row.value.trim();
      }
    }

    startTransition(async () => {
      try {
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

        router.push("/inventory");
        router.refresh();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to create inventory item."
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs">
      <div>
        <h1 className="text-lg font-bold text-neutral-950 dark:text-white">Create Inventory Product</h1>
        <p className="text-neutral-500 mt-1">
          Add an item to your tenant catalog with dynamic JSONB specs and stock alert rules.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Section 1: Classification */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
          1. General Details & Identification
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
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-neutral-700 dark:text-neutral-300">Barcode</label>
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
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InventoryItemStatus)}
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            >
              <option value="active">Active</option>
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
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Brand</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. KeyPulse"
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-neutral-700 dark:text-neutral-300">Category</label>
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
                className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
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
              placeholder="pcs, kg, box"
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
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
            placeholder="Detailed product information..."
            className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          />
        </div>
      </div>

      <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Section 2: Pricing & Margins */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
            2. Pricing & Financial Margins
          </h3>
          <span
            className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded ${
              isHealthyMargin
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
            }`}
          >
            Margin: {grossMarginPercent}% (₹{grossProfit.toFixed(2)}/unit profit)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Buy Price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={buyPrice}
              onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Sell Price (₹)
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

      {/* Section 3: Stock */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
          3. Stock & Alerts
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Initial Stock Quantity
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
              Min Stock Alert
            </label>
            <input
              type="number"
              min="0"
              value={minStockAlert}
              onChange={(e) => setMinStockAlert(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Max Capacity
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
              Location / Shelf
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Rack A-1"
              className="w-full px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Section 4: Dynamic Features (features JSONB) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
            4. Dynamic Specifications Builder (features JSONB)
          </h3>
          <button
            type="button"
            onClick={() => addFeatureRow()}
            className="text-xs font-medium px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            + Add Attribute
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-neutral-400">Suggestions:</span>
          {PRESET_FEATURE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => addFeatureRow(key)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              +{key}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {featureRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Key"
                value={row.key}
                onChange={(e) => updateFeatureRow(idx, "key", e.target.value)}
                className="w-1/3 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
              <input
                type="text"
                placeholder="Value"
                value={row.value}
                onChange={(e) => updateFeatureRow(idx, "value", e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
              />
              <button
                type="button"
                onClick={() => removeFeatureRow(idx)}
                className="p-1.5 text-neutral-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Section 5: Image Gallery */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 font-mono">
          5. Image Gallery & Thumbnails
        </h3>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-neutral-400">Presets:</span>
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
              className="text-[10px] px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              +{preset.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Image URL"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
          />
          <input
            type="text"
            placeholder="Alt text"
            value={newImageAlt}
            onChange={(e) => setNewImageAlt(e.target.value)}
            className="w-1/3 px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
          />
          <button
            type="button"
            onClick={addImage}
            className="px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium"
          >
            Add Image
          </button>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {images.map((img, i) => (
              <div
                key={i}
                className={`relative group rounded-lg overflow-hidden border p-1 bg-neutral-50 dark:bg-neutral-900 ${
                  img.is_primary ? "border-blue-500 ring-2 ring-blue-500/20" : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div className="aspect-square w-full rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt || name} className="w-full h-full object-cover" />
                  {img.is_primary && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-600 text-white shadow">
                      PRIMARY
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px]">
                  {!img.is_primary ? (
                    <button type="button" onClick={() => setPrimaryImage(i)} className="text-neutral-500 hover:text-neutral-900">
                      Make Primary
                    </button>
                  ) : (
                    <span className="text-blue-500 font-semibold">Thumbnail</span>
                  )}
                  <button type="button" onClick={() => removeImage(i)} className="text-red-500 hover:text-red-700">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Controls */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/inventory")}
          className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          <span>Create Product</span>
        </button>
      </div>
    </form>
  );
}
