import {
  SignInButton,
  SignUpButton,
  Show,
} from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default async function Home() {
  const { userId, orgId, orgRole, orgSlug } = await auth();

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-200 flex flex-col justify-between font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <Navbar />


      {/* Main Workspace Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <Show when="signed-out">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 rounded-lg p-6 sm:p-8 shadow-sm dark:shadow-none">
              <h1 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
                Inventra System
              </h1>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 mb-6 leading-relaxed">
                Enterprise inventory and billing platform. Sign in to access your tenant workspace.
              </p>

              <div className="flex flex-col gap-2.5">
                <SignInButton mode="modal">
                  <button className="w-full text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-800 dark:text-white dark:border dark:border-neutral-700 dark:hover:bg-neutral-700 py-2 rounded-md transition-colors cursor-pointer shadow-sm">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="w-full text-xs font-medium text-neutral-800 dark:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 py-2 rounded-md transition-colors cursor-pointer">
                    Create Account
                  </button>
                </SignUpButton>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                <span>Direct Links:</span>
                <div className="flex gap-3">
                  <Link href="/sign-in" className="hover:text-neutral-900 dark:hover:text-neutral-200">
                    /sign-in
                  </Link>
                  <Link href="/sign-up" className="hover:text-neutral-900 dark:hover:text-neutral-200">
                    /sign-up
                  </Link>
                </div>
              </div>
            </div>
          </Show>

          <Show when="signed-in">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 rounded-lg p-6 sm:p-8 shadow-sm dark:shadow-none space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h1 className="text-base font-semibold tracking-tight text-neutral-950 dark:text-white">
                    Workspace Overview
                  </h1>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                    Phase 1: Multi-Tenancy Data Isolation Active
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {orgId ? "Tenant Isolated" : "Org Required"}
                </span>
              </div>

              {!orgId ? (
                <div className="p-4 rounded-md border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>No Active Organization Selected</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                    Please use the organization switcher in the top bar to select or create your organization. All inventory and billing records are isolated by tenant ID (<code className="font-mono">org_id</code>).
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Active Organization</span>
                    <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">{orgSlug || "Default Org"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Tenant ID (`org_id`)</span>
                    <span className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 max-w-[200px] truncate" title={orgId}>
                      {orgId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Your Role</span>
                    <span className="font-mono uppercase text-[11px] text-neutral-700 dark:text-neutral-300">{orgRole || "member"}</span>
                  </div>
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Link
                      href="/dashboard"
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all shadow-xs col-span-1 sm:col-span-2 text-center"
                    >
                      <span>Financial Dashboard & Analytics</span>
                      <span>&rarr;</span>
                    </Link>
                    <Link
                      href="/inventory"
                      className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-center"
                    >
                      <span>Inventory Catalog</span>
                    </Link>
                    <Link
                      href="/billing"
                      className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-3 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-center"
                    >
                      <span>Billing & Invoices</span>
                    </Link>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-neutral-200/80 dark:border-neutral-800/80">
                  <span className="text-neutral-500">RLS Policy Pattern</span>
                  <span className="font-mono text-[11px] text-neutral-800 dark:text-neutral-300">
                    (auth.jwt()-&gt;&apos;org_id&apos;) = org_id
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-neutral-200/80 dark:border-neutral-800/80">
                  <span className="text-neutral-500">Tenant-Scoped Tables</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-300">6 (categories, items, movements, customers, invoices, items)</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-neutral-200/80 dark:border-neutral-800/80">
                  <span className="text-neutral-500">Server Action Context</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">auth().orgId Enforced</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-neutral-500">Database Engine</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-300">Supabase (PostgreSQL)</span>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </main>

      {/* Enterprise Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-4 text-center text-[11px] font-mono text-neutral-500 dark:text-neutral-600">
        Inventra Enterprise &bull; Multi-Tenant Data Isolation Active
      </footer>
    </div>
  );
}
