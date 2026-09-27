import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { fetchCategories, fetchInventoryItems } from "@/lib/db/inventory";
import { Category, InventoryItem } from "@/types/inventory";

export const metadata = {
  title: "Inventory Catalog | Inventra Enterprise",
  description: "Manage product catalog, SKU tracking, stock thresholds, and margin calculations.",
};

export default async function InventoryPage() {
  const { userId, orgId } = await auth();

  // 1. Unauthenticated state
  if (!userId) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 bg-neutral-50/50 dark:bg-neutral-900/40 text-center space-y-4">
            <div className="text-3xl">🔒</div>
            <h1 className="text-lg font-semibold text-neutral-950 dark:text-white">
              Authentication Required
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Please sign in to access the Inventra enterprise inventory catalog.
            </p>
            <div className="pt-2">
              <Link
                href="/sign-in"
                className="inline-block px-4 py-2 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Sign In
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Authenticated but no active tenant organization selected
  if (!orgId) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-amber-200 dark:border-amber-900/50 rounded-xl p-8 bg-amber-50/40 dark:bg-amber-950/20 text-center space-y-4">
            <div className="text-3xl">🏢</div>
            <h1 className="text-base font-semibold text-amber-950 dark:text-amber-200">
              No Active Organization Selected
            </h1>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Inventra uses strict multi-tenant data isolation. To view or create inventory items, select or create an organization from the switcher in the top navigation bar.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                &uarr; Click Organization Switcher in Navbar
              </span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Load tenant-scoped catalog & categories
  let items: InventoryItem[] = [];
  let categories: Category[] = [];
  let loadError: string | null = null;

  try {
    [items, categories] = await Promise.all([
      fetchInventoryItems(),
      fetchCategories(),
    ]);
  } catch (err: unknown) {
    const errorObj = err as { message?: string; details?: string; hint?: string; code?: string };
    loadError =
      errorObj?.message ||
      (typeof err === "object" && err !== null ? JSON.stringify(err) : String(err));
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {loadError ? (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs space-y-2">
            <div className="font-semibold">Failed to load tenant inventory data</div>
            <div className="font-mono text-[11px]">{loadError}</div>
          </div>
        ) : (
          <InventoryTable initialItems={items} categories={categories} />
        )}
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 text-center text-[11px] font-mono text-neutral-500 dark:text-neutral-600">
        Inventra Enterprise &bull; Inventory Catalog Scoped to Org ID: {orgId}
      </footer>
    </div>
  );
}
