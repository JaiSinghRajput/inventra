import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { fetchItemById, fetchStockMovementsByItemId } from "@/lib/db/inventory";
import { StockMovementsView } from "@/components/inventory/stock-movements-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Stock Audit Ledger | Inventra Enterprise",
  description: "Immutable stock movement audit trail and historical inventory records.",
};

export default async function ItemMovementsPage({ params }: PageProps) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect("/");
  }

  const { id } = await params;

  const item = await fetchItemById(id);
  if (!item) {
    notFound();
  }

  const movements = await fetchStockMovementsByItemId(id);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <StockMovementsView item={item} movements={movements} />
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 text-center text-[11px] font-mono text-neutral-500 dark:text-neutral-600">
        Inventra Enterprise &bull; Immutable Audit Trail Scoped to Org ID: {orgId}
      </footer>
    </div>
  );
}
