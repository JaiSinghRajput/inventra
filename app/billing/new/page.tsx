import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { InvoiceGenerator } from "@/components/billing/invoice-generator";
import { fetchInventoryItems } from "@/lib/db/inventory";
import { fetchCustomers, generateNextInvoiceNumber } from "@/lib/db/billing";
import { Customer } from "@/types/billing";
import { InventoryItem } from "@/types/inventory";

export const metadata = {
  title: "New Invoice / POS Terminal | Inventra Enterprise",
  description: "Generate multi-tenant commercial invoices, register live sales, deduct stock, and collect client payments.",
};

interface PageProps {
  searchParams: Promise<{ customer_id?: string }>;
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const { userId, orgId } = await auth();
  const resolvedParams = await searchParams;
  const preselectedCustomerId = resolvedParams.customer_id;

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
              Please sign in to access the Inventra invoice generator.
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
              Invoicing requires an active tenant organization context. Please select or create an organization.
            </p>
          </div>
        </main>
      </div>
    );
  }

  let products: InventoryItem[] = [];
  let customers: Customer[] = [];
  let nextInvNumber = "INV-2026-0001";
  let errorMsg: string | null = null;

  try {
    const [fetchedProducts, fetchedCustomers, nextNumber] = await Promise.all([
      fetchInventoryItems(),
      fetchCustomers(),
      generateNextInvoiceNumber(),
    ]);
    products = fetchedProducts;
    customers = fetchedCustomers;
    nextInvNumber = nextNumber;
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {errorMsg ? (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs">
            {errorMsg}
          </div>
        ) : (
          <InvoiceGenerator
            initialProducts={products}
            initialCustomers={customers}
            defaultInvoiceNumber={nextInvNumber}
            preselectedCustomerId={preselectedCustomerId}
          />
        )}
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 text-center text-[11px] font-mono text-neutral-500 dark:text-neutral-600">
        Inventra Enterprise &bull; Invoice Engine Scoped to Org ID: {orgId}
      </footer>
    </div>
  );
}
