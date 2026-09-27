"use client";

import { useState } from "react";
import Link from "next/link";
import { AnalyticsData } from "@/lib/db/analytics";
import { formatCurrency, formatCompactCurrency } from "@/lib/currency";
import { useClerkRole } from "@/lib/hooks/use-clerk-role";

interface DashboardViewProps {
  data: AnalyticsData;
}

export function DashboardView({ data }: DashboardViewProps) {
  const { role, permissions } = useClerkRole();
  const { metrics, lowStockItems, outOfStockItems, topSellingItems, categoryReports } = data;
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "categories">("overview");

  // If role does not permit executive financial telemetry, display role-restricted state
  if (!permissions.canViewExecutiveAnalytics) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-3xl">
          🔒
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Executive Analytics Restricted
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
            Your current Clerk organization role is <strong className="font-mono text-neutral-900 dark:text-neutral-200 uppercase">{role}</strong>. Confidential cost valuation, inventory profit margins, and executive balance sheets are restricted to Organization Administrators and Managers.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/billing/new"
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
          >
            Open POS Billing Terminal
          </Link>
          <Link
            href="/billing"
            className="w-full sm:w-auto px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
          >
            View Invoices
          </Link>
        </div>
      </div>
    );
  }

  // Calculate highest revenue product for relative progress bars
  const maxRevenue = topSellingItems.length > 0 ? topSellingItems[0].totalRevenue : 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Executive Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white flex items-center gap-2">
            <span>{permissions.canViewProfits ? "Financial Analytics & Business Intelligence" : "Operations & Sales Dashboard"}</span>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {permissions.canViewProfits
              ? "Real-time inventory valuation at cost vs. retail, gross profit margins, sales velocity, and stock health."
              : "Operational overview: retail inventory tracking, confirmed sales invoicing, and real-time stock alert health."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {permissions.canEditInventory && (
            <Link
              href="/inventory/new"
              className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-xs"
            >
              + Add Product
            </Link>
          )}
          <Link
            href="/billing/new"
            className="px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
          >
            + New POS Invoice
          </Link>
        </div>
      </div>

      {/* KPI Financial Cards Grid (Simplified 3-tile grid for Member, 4-tile for Admin/Manager) */}
      <div className={`grid grid-cols-2 ${permissions.canViewProfits ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 sm:gap-4`}>
        {/* Card 1: Total Inventory Retail Value */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-xs space-y-1">
          <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            Total Inventory (Retail)
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-950 dark:text-white">
            {formatCurrency(metrics.totalInventoryRetailValue)}
          </div>
          {permissions.canViewCosts && (
            <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-900">
              <span>At Cost:</span>
              <span className="font-mono">{formatCurrency(metrics.totalInventoryCostValue)}</span>
            </div>
          )}
        </div>

        {/* Card 2: Unrealized Gross Profit - Only visible when profits are permitted */}
        {permissions.canViewProfits && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs space-y-1">
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>Potential Profit</span>
              <span className="font-bold">{metrics.overallInventoryMargin}%</span>
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.unrealizedProfit)}
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 pt-1 border-t border-emerald-500/15">
              Avg markup: {metrics.overallInventoryMargin}% on retail
            </div>
          </div>
        )}

        {/* Card 3: Total Invoiced Sales */}
        <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-xs space-y-1">
          <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
            Total Sales Invoiced
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-neutral-950 dark:text-white">
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-900">
            <span>Collected:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalCollected)}
            </span>
          </div>
        </div>

        {/* Card 4: Outstanding Receivables */}
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-xs space-y-1">
          <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Outstanding Receivables
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {formatCurrency(metrics.outstandingReceivables)}
          </div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 pt-1 border-t border-amber-500/15">
            {metrics.outstandingReceivables > 0 ? "Pending customer settlement" : "Zero pending balance"}
          </div>
        </div>
      </div>

      {/* Stock Health Alert Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-sm">
              📦
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-950 dark:text-white">Active Catalog Items</div>
              <div className="text-[11px] text-neutral-500">{metrics.totalItemsCount} distinct product lines</div>
            </div>
          </div>
          <Link href="/inventory" className="text-xs font-semibold hover:underline text-neutral-800 dark:text-neutral-200">
            View &rarr;
          </Link>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          metrics.lowStockCount > 0
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold text-xs">
              ⚠️
            </div>
            <div>
              <div className="text-xs font-semibold">Low Stock Threshold Alerts</div>
              <div className="text-[11px] opacity-80">{metrics.lowStockCount} items near minimum alert</div>
            </div>
          </div>
          <span className="font-mono font-bold text-base">{metrics.lowStockCount}</span>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          metrics.outOfStockCount > 0
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-600 flex items-center justify-center font-bold text-xs">
              ⛔
            </div>
            <div>
              <div className="text-xs font-semibold">Out of Stock Warnings</div>
              <div className="text-[11px] opacity-80">{metrics.outOfStockCount} zero stock depletion items</div>
            </div>
          </div>
          <span className="font-mono font-bold text-base">{metrics.outOfStockCount}</span>
        </div>
      </div>

      {/* Navigation Tabs for Analytics Sections */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === "overview"
              ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white font-bold"
              : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          Critical Stock Telemetry & Alerts ({lowStockItems.length + outOfStockItems.length})
        </button>

        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === "sales"
              ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white font-bold"
              : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          Top-Selling Velocity Reports ({topSellingItems.length})
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
            activeTab === "categories"
              ? "border-neutral-950 text-neutral-950 dark:border-white dark:text-white font-bold"
              : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          {permissions.canViewMargins ? "Category Margin Breakdown" : "Category Catalog Breakdown"} ({categoryReports.length})
        </button>
      </div>

      {/* Tab Content 1: Overview & Stock Health Alerts */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Out of Stock Section */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-xs">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-950 dark:text-white">
                  Zero Stock / Depleted Items ({outOfStockItems.length})
                </h2>
              </div>
              <span className="text-[11px] text-neutral-500">Requires urgent PO restock</span>
            </div>

            {outOfStockItems.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                ✓ No inventory items are currently out of stock. Stock levels are healthy.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {outOfStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-neutral-950 dark:text-white">
                          {item.name}
                        </span>
                        {item.brand && (
                          <span className="text-[10px] text-neutral-500 font-normal">
                            ({item.brand})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        SKU: {item.sku} &bull; Retail: {formatCurrency(item.sell_price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-red-500/10 text-red-500 border border-red-500/20">
                        0 {item.unit} available
                      </span>
                      <Link
                        href={`/inventory/${item.id}/movements`}
                        className="px-3 py-1 rounded text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90"
                      >
                        Adjust / Restock
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Warning Section */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-xs">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-950 dark:text-white">
                  Low Stock Threshold Alerts ({lowStockItems.length})
                </h2>
              </div>
              <span className="text-[11px] text-neutral-500">Quantity below configured threshold</span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                ✓ No inventory items are currently below their minimum stock alert threshold.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-neutral-950 dark:text-white">
                          {item.name}
                        </span>
                        {item.brand && (
                          <span className="text-[10px] text-neutral-500 font-normal">
                            ({item.brand})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        SKU: {item.sku} &bull; Min Alert: {item.min_stock_alert} {item.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {item.stock_quantity} {item.unit} left
                      </span>
                      <Link
                        href={`/inventory/${item.id}/movements`}
                        className="px-3 py-1 rounded text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      >
                        Ledger
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Sales & Velocity Reports (6.2) */}
      {activeTab === "sales" && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-xs">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-950 dark:text-white">
                Top-Selling Products by Revenue & Volume
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Aggregated from confirmed commercial sales invoices.
              </p>
            </div>
            {permissions.canViewMargins && (
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                Realized Margin: {metrics.realizedMarginPercent}%
              </span>
            )}
          </div>

          {topSellingItems.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 text-xs space-y-2">
              <div className="text-2xl">📊</div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">No sales transactions recorded yet</p>
              <p className="text-neutral-400">Generate POS invoices to track sales performance.</p>
              <div className="pt-2">
                <Link
                  href="/billing/new"
                  className="inline-block px-3.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold"
                >
                  Create First Invoice
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {topSellingItems.map((item, idx) => {
                const percentShare = Math.round((item.totalRevenue / maxRevenue) * 100);

                return (
                  <div key={item.itemId || idx} className="p-4 space-y-2.5 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono font-bold flex items-center justify-center text-neutral-600 dark:text-neutral-300 shrink-0">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-neutral-950 dark:text-white">
                            {item.name}
                          </div>
                          {item.sku && (
                            <div className="text-[10px] font-mono text-neutral-500">
                              SKU: {item.sku}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div>
                          <span className="text-neutral-400 text-[10px] uppercase block">Units Sold</span>
                          <span className="font-bold text-neutral-950 dark:text-white">{item.totalUnitsSold}</span>
                        </div>

                        <div>
                          <span className="text-neutral-400 text-[10px] uppercase block">Revenue</span>
                          <span className="font-bold text-neutral-950 dark:text-white">{formatCurrency(item.totalRevenue)}</span>
                        </div>

                        {permissions.canViewProfits && (
                          <div>
                            <span className="text-neutral-400 text-[10px] uppercase block">Gross Profit</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.totalProfit)}</span>
                          </div>
                        )}

                        {permissions.canViewMargins && (
                          <div>
                            <span className="text-neutral-400 text-[10px] uppercase block">Margin</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              {item.marginPercent}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Relative Velocity Progress Bar */}
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-neutral-900 dark:bg-white h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentShare}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 3: Category Profit Margin Breakdown (6.2) */}
      {activeTab === "categories" && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-xs">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-950 dark:text-white">
                Category Valuation & Profit Margin Distribution
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Breakdown of inventory investment, projected margins, and realized sales by category.
              </p>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              {categoryReports.length} Active Categories
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-mono">
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-3 text-center">Products</th>
                  {permissions.canViewCosts && <th className="py-2.5 px-3 text-right">Cost Value</th>}
                  <th className="py-2.5 px-3 text-right">Retail Value</th>
                  {permissions.canViewProfits && <th className="py-2.5 px-3 text-right">Potential Profit</th>}
                  {permissions.canViewMargins && <th className="py-2.5 px-4 text-right">Avg Margin</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {categoryReports.map((cat) => {
                  const isHealthy = cat.averageMarginPercent >= 25;
                  const isModerate = cat.averageMarginPercent >= 15 && cat.averageMarginPercent < 25;

                  return (
                    <tr key={cat.categoryId} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-neutral-950 dark:text-white">
                        {cat.categoryName}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-neutral-600 dark:text-neutral-400">
                        {cat.itemCount} SKUs
                      </td>

                      {permissions.canViewCosts && (
                        <td className="py-3 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                          {formatCurrency(cat.costValue)}
                        </td>
                      )}

                      <td className="py-3 px-3 text-right font-mono font-medium text-neutral-950 dark:text-white">
                        {formatCurrency(cat.retailValue)}
                      </td>

                      {permissions.canViewProfits && (
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(cat.potentialProfit)}
                        </td>
                      )}

                      {permissions.canViewMargins && (
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                              isHealthy
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : isModerate
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            }`}
                          >
                            {cat.averageMarginPercent}%
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
