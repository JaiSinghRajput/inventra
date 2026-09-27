import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { fetchCategories } from "@/lib/db/inventory";
import { ProductCreateForm } from "@/components/inventory/product-create-form";
import { resolveUserRole, getPermissions } from "@/lib/rbac";

export const metadata = {
  title: "New Product | Inventra Enterprise",
  description: "Create a new inventory item with pricing, alert thresholds, and dynamic specifications.",
};

export default async function NewProductPage() {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect("/");
  }

  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canEditInventory) {
    redirect("/inventory");
  }

  const categories = await fetchCategories();

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/inventory"
              className="text-xs text-neutral-500 hover:text-neutral-950 dark:hover:text-white transition-colors"
            >
              &larr; Back to Catalog
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="text-xs font-semibold text-neutral-900 dark:text-white">New Product</span>
          </div>
        </div>

        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-[#121215] shadow-xs p-6 sm:p-8">
          <ProductCreateForm categories={categories} />
        </div>
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 text-center text-[11px] font-mono text-neutral-500 dark:text-neutral-600">
        Inventra Enterprise &bull; Product Creation
      </footer>
    </div>
  );
}
