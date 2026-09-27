import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { fetchCustomerById, fetchCustomerInvoices } from "@/lib/db/billing";
import { CustomerProfileView } from "@/components/customers/customer-profile-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Customer Profile & Invoices | Inventra Enterprise",
  description: "View customer details, billing profile, lifetime order volume, and historical purchase invoices.",
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgId) {
    redirect("/");
  }

  const { id } = await params;

  const customer = await fetchCustomerById(id);
  if (!customer) {
    notFound();
  }

  const invoices = await fetchCustomerInvoices(id);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <CustomerProfileView customer={customer} invoices={invoices} />
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 text-center text-[11px] font-mono text-neutral-500 dark:text-neutral-600">
        Inventra Enterprise &bull; Customer Account Scoped to Org ID: {orgId}
      </footer>
    </div>
  );
}
