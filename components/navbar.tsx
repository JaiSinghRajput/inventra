"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    href: "/billing",
    label: "Billing",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0v8.25m0 0a3 3 0 003 3h13.5a3 3 0 003-3V6m0 0v-.75A.75.75 0 0021 4.5h-1.5m0 0V3a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 3v1.5m15 0H4.5" />
      </svg>
    ),
  },
  {
    href: "/customers",
    label: "Customers",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

function ClerkRoleBadge() {
  const { orgRole } = useAuth();
  if (!orgRole) return null;

  const roleName = orgRole.replace("org:", "").toUpperCase();
  const isCashier = roleName === "CASHIER";
  const isManager = roleName === "MANAGER";
  const isAdmin = roleName === "ADMIN";

  return (
    <span
      className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
        isAdmin
          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
          : isManager
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          : isCashier
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20"
      }`}
      title={`Clerk Role: ${orgRole}`}
    >
      <span>{isAdmin ? "👑" : isManager ? "👔" : isCashier ? "💳" : "👤"}</span>
      <span>{roleName}</span>
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Brand + Org Switcher */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <Link
              href="/"
              className="flex items-center gap-2 group transition-opacity hover:opacity-90 shrink-0"
            >
              <div className="w-6 h-6 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center font-bold text-xs shadow-sm">
                I
              </div>
              <span className="font-semibold text-sm tracking-tight text-neutral-950 dark:text-white hidden xs:inline">
                Inventra
              </span>
            </Link>

            <span className="text-neutral-300 dark:text-neutral-700 hidden xs:inline">/</span>

            <Show when="signed-in">
              <div className="max-w-[140px] sm:max-w-[200px] truncate">
                <OrganizationSwitcher
                  hidePersonal={false}
                  afterCreateOrganizationUrl="/inventory"
                  afterSelectOrganizationUrl="/inventory"
                  afterLeaveOrganizationUrl="/"
                  appearance={{
                    elements: {
                      rootBox: "flex items-center",
                      organizationSwitcherTrigger:
                        "text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white px-1.5 sm:px-2 py-1 rounded border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 focus:outline-none transition-all truncate",
                      organizationPreviewTextContainer:
                        "text-neutral-900 dark:text-neutral-100 font-medium text-xs truncate",
                      organizationPreviewMainIdentifier:
                        "text-neutral-900 dark:text-white font-medium text-xs truncate",
                      organizationSwitcherTriggerIcon:
                        "text-neutral-500 dark:text-neutral-400 text-xs ml-1 shrink-0",
                    },
                  }}
                />
              </div>
            </Show>

            <Show when="signed-out">
              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                Enterprise
              </span>
            </Show>

            {/* Desktop Navigation Links */}
            <Show when="signed-in">
              <nav className="hidden md:flex items-center gap-1 ml-2">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${isActive
                          ? "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-950 dark:text-white font-semibold"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                        }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </Show>
          </div>

          {/* Right Controls: Theme Toggle & Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <ThemeToggle />

            <div className="h-4 w-px bg-neutral-200 dark:border-neutral-800 mx-0.5" />

            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="text-xs font-medium text-neutral-600 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-800 dark:text-white dark:border dark:border-neutral-700 dark:hover:bg-neutral-700 px-3 py-1.5 rounded-md transition-colors cursor-pointer shadow-sm">
                  Sign Up
                </button>
              </SignUpButton>
            </Show>

            <Show when="signed-in">
              <div className="flex items-center gap-2">
                <ClerkRoleBadge />
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-7 h-7",
                    },
                  }}
                />

                {/* Mobile Quick Menu Hamburger Button */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label="Toggle Navigation Menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    )}
                  </svg>
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Mobile Dropdown Menu (Top Header) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-white/98 dark:bg-[#09090b]/98 backdrop-blur-xl px-4 py-3 space-y-2 animate-in slide-in-from-top duration-200">
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Link
                href="/inventory/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold shadow-sm text-center"
              >
                <span>+ Product</span>
              </Link>
              <Link
                href="/billing/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-xs font-semibold shadow-sm text-center"
              >
                <span>+ POS Invoice</span>
              </Link>
            </div>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-900 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                        ? "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-950 dark:text-white font-semibold"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                      }`}
                  >
                    <span className="text-neutral-500">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Floating Modern Mobile Bottom Navigation Bar */}
      <Show when="signed-in">
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-all ${isActive
                    ? "text-neutral-950 dark:text-white font-semibold scale-105"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  }`}
              >
                <div className="relative">
                  {item.icon}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-neutral-950 dark:bg-white" />
                  )}
                </div>
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </Show>
    </>
  );
}
