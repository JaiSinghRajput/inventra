"use server";

import { getTenantContext } from "@/lib/tenant";
import { resolveUserRole } from "@/lib/rbac";

export interface DashboardMetrics {
  totalInventoryCostValue: number;
  totalInventoryRetailValue: number;
  unrealizedProfit: number;
  overallInventoryMargin: number;
  totalRevenue: number;
  totalCollected: number;
  outstandingReceivables: number;
  realizedGrossProfit: number;
  realizedMarginPercent: number;
  totalItemsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface InventoryAlertItem {
  id: string;
  name: string;
  sku: string;
  brand?: string | null;
  stock_quantity: number;
  min_stock_alert: number;
  unit: string;
  sell_price: number;
  status: string;
}

export interface TopSellingItem {
  itemId: string | null;
  name: string;
  sku: string | null;
  totalUnitsSold: number;
  totalRevenue: number;
  totalProfit: number;
  marginPercent: number;
}

export interface CategoryMarginReport {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  averageMarginPercent: number;
  realizedRevenue: number;
  realizedProfit: number;
}

export interface AnalyticsData {
  metrics: DashboardMetrics;
  lowStockItems: InventoryAlertItem[];
  outOfStockItems: InventoryAlertItem[];
  topSellingItems: TopSellingItem[];
  categoryReports: CategoryMarginReport[];
}

/**
 * Fetches and aggregates complete financial analytics, sales reports,
 * and inventory health telemetry strictly scoped to the active tenant organization.
 */
export async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const hideCostAndProfit = role === "cashier" || role === "member";

  // 1. Parallel fetch of tenant data
  const [itemsRes, categoriesRes, invoicesRes, invoiceItemsRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .eq("org_id", orgId),
    supabase
      .from("categories")
      .select("*")
      .eq("org_id", orgId),
    supabase
      .from("invoices")
      .select("*")
      .eq("org_id", orgId),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("org_id", orgId),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);
  if (invoicesRes.error) throw new Error(invoicesRes.error.message);
  if (invoiceItemsRes.error) throw new Error(invoiceItemsRes.error.message);

  const items = itemsRes.data || [];
  const categories = categoriesRes.data || [];
  const invoices = invoicesRes.data || [];
  const invoiceItems = invoiceItemsRes.data || [];

  // 2. Compute Inventory Values & Stock Alerts
  let totalCostVal = 0;
  let totalRetailVal = 0;
  const lowStockList: InventoryAlertItem[] = [];
  const outOfStockList: InventoryAlertItem[] = [];

  for (const it of items) {
    const qty = Number(it.stock_quantity || 0);
    const buy = Number(it.buy_price || 0);
    const sell = Number(it.sell_price || 0);
    const minAlert = Number(it.min_stock_alert || 5);

    totalCostVal += buy * qty;
    totalRetailVal += sell * qty;

    if (qty === 0) {
      outOfStockList.push({
        id: it.id,
        name: it.name,
        sku: it.sku,
        brand: it.brand,
        stock_quantity: qty,
        min_stock_alert: minAlert,
        unit: it.unit || "pcs",
        sell_price: sell,
        status: it.status,
      });
    } else if (qty <= minAlert) {
      lowStockList.push({
        id: it.id,
        name: it.name,
        sku: it.sku,
        brand: it.brand,
        stock_quantity: qty,
        min_stock_alert: minAlert,
        unit: it.unit || "pcs",
        sell_price: sell,
        status: it.status,
      });
    }
  }

  const unrealizedProfit = Math.max(0, totalRetailVal - totalCostVal);
  const overallInventoryMargin =
    totalRetailVal > 0 ? (unrealizedProfit / totalRetailVal) * 100 : 0;

  // 3. Compute Invoice Financials
  let totalRevenue = 0;
  let totalCollected = 0;

  for (const inv of invoices) {
    if (inv.status !== "cancelled") {
      totalRevenue += Number(inv.total_amount || 0);
      totalCollected += Number(inv.amount_paid || 0);
    }
  }
  const outstandingReceivables = Math.max(0, totalRevenue - totalCollected);

  // 4. Compute Realized Sales & Top-Selling Items
  let totalRealizedRevenue = 0;
  let totalRealizedCOGS = 0;

  const itemSalesMap = new Map<
    string,
    {
      itemId: string | null;
      name: string;
      sku: string | null;
      units: number;
      revenue: number;
      cogs: number;
    }
  >();

  for (const line of invoiceItems) {
    const qty = Number(line.quantity || 0);
    const unitPrice = Number(line.unit_price || 0);
    const buyPrice = Number(line.buy_price || 0);
    const lineTotal = Number(line.line_total || unitPrice * qty);

    const cogs = buyPrice * qty;
    totalRealizedRevenue += lineTotal;
    totalRealizedCOGS += cogs;

    const key = line.item_id || line.item_name;
    const existing = itemSalesMap.get(key) || {
      itemId: line.item_id || null,
      name: line.item_name,
      sku: line.sku || null,
      units: 0,
      revenue: 0,
      cogs: 0,
    };

    existing.units += qty;
    existing.revenue += lineTotal;
    existing.cogs += cogs;
    itemSalesMap.set(key, existing);
  }

  const realizedGrossProfit = totalRealizedRevenue - totalRealizedCOGS;
  const realizedMarginPercent =
    totalRealizedRevenue > 0
      ? (realizedGrossProfit / totalRealizedRevenue) * 100
      : 0;

  const topSellingItems: TopSellingItem[] = Array.from(itemSalesMap.values())
    .map((s) => {
      const profit = s.revenue - s.cogs;
      const margin = s.revenue > 0 ? (profit / s.revenue) * 100 : 0;
      return {
        itemId: s.itemId,
        name: s.name,
        sku: s.sku,
        totalUnitsSold: s.units,
        totalRevenue: s.revenue,
        totalProfit: profit,
        marginPercent: parseFloat(margin.toFixed(1)),
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  // 5. Compute Category Margin Breakdown
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.id, c.name);
  }

  const categoryAggMap = new Map<
    string,
    {
      categoryId: string;
      name: string;
      itemCount: number;
      costVal: number;
      retailVal: number;
      realizedRev: number;
      realizedProf: number;
    }
  >();

  // Aggregate inventory by category
  for (const it of items) {
    const catId = it.category_id || "uncategorized";
    const catName = categoryMap.get(catId) || "General & Uncategorized";
    const qty = Number(it.stock_quantity || 0);
    const buy = Number(it.buy_price || 0) * qty;
    const sell = Number(it.sell_price || 0) * qty;

    const existing = categoryAggMap.get(catId) || {
      categoryId: catId,
      name: catName,
      itemCount: 0,
      costVal: 0,
      retailVal: 0,
      realizedRev: 0,
      realizedProf: 0,
    };

    existing.itemCount += 1;
    existing.costVal += buy;
    existing.retailVal += sell;
    categoryAggMap.set(catId, existing);
  }

  // Aggregate sales by category
  const itemCategoryLookup = new Map<string, string>();
  for (const it of items) {
    if (it.id) {
      itemCategoryLookup.set(it.id, it.category_id || "uncategorized");
    }
  }

  for (const line of invoiceItems) {
    const catId = line.item_id ? itemCategoryLookup.get(line.item_id) || "uncategorized" : "uncategorized";
    const entry = categoryAggMap.get(catId);
    if (entry) {
      const rev = Number(line.line_total || 0);
      const cogs = Number(line.buy_price || 0) * Number(line.quantity || 0);
      entry.realizedRev += rev;
      entry.realizedProf += (rev - cogs);
    }
  }

  const categoryReports: CategoryMarginReport[] = Array.from(categoryAggMap.values())
    .map((c) => {
      const potProfit = hideCostAndProfit ? 0 : Math.max(0, c.retailVal - c.costVal);
      const avgMargin = (!hideCostAndProfit && c.retailVal > 0) ? (potProfit / c.retailVal) * 100 : 0;

      return {
        categoryId: c.categoryId,
        categoryName: c.name,
        itemCount: c.itemCount,
        costValue: hideCostAndProfit ? 0 : c.costVal,
        retailValue: c.retailVal,
        potentialProfit: potProfit,
        averageMarginPercent: parseFloat(avgMargin.toFixed(1)),
        realizedRevenue: c.realizedRev,
        realizedProfit: hideCostAndProfit ? 0 : c.realizedProf,
      };
    })
    .sort((a, b) => b.retailValue - a.retailValue);

  return {
    metrics: {
      totalInventoryCostValue: hideCostAndProfit ? 0 : totalCostVal,
      totalInventoryRetailValue: totalRetailVal,
      unrealizedProfit: hideCostAndProfit ? 0 : unrealizedProfit,
      overallInventoryMargin: hideCostAndProfit ? 0 : parseFloat(overallInventoryMargin.toFixed(1)),
      totalRevenue,
      totalCollected,
      outstandingReceivables,
      realizedGrossProfit: hideCostAndProfit ? 0 : realizedGrossProfit,
      realizedMarginPercent: hideCostAndProfit ? 0 : parseFloat(realizedMarginPercent.toFixed(1)),
      totalItemsCount: items.length,
      lowStockCount: lowStockList.length,
      outOfStockCount: outOfStockList.length,
    },
    lowStockItems: lowStockList,
    outOfStockItems: outOfStockList,
    topSellingItems: hideCostAndProfit
      ? topSellingItems.map((item) => ({ ...item, totalProfit: 0, marginPercent: 0 }))
      : topSellingItems,
    categoryReports,
  };
}
