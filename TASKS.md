# Inventra — Project Roadmap & Task List

An enterprise, multi-tenant inventory management and billing platform built with Next.js 16, Clerk Authentication, and Supabase (PostgreSQL).

---

## Current Status (Foundation Completed)
- [x] **Clerk Authentication**: Next.js 16 proxy configured, `<ClerkProvider>` initialized, custom minimal Sign-in / Sign-up views.
- [x] **Multi-Tenancy Support**: `<OrganizationSwitcher />` integrated in the top navbar displaying active organization name and logo.
- [x] **Supabase Setup**: Client, server, and middleware SSR utilities configured in `utils/supabase/`.
- [x] **Enterprise Minimal Theme**: High-contrast, clean Dark and Light mode with zero-flicker theme toggle (`components/theme-toggle.tsx`) and global font configuration in `app/globals.css`.
- [x] **Database Architecture**: Flexible schema with relational financial integrity and indexed `JSONB` document stores (`features`, `images`, `metadata`) in `supabase/schema.sql`.
- [x] **TypeScript Definitions**: Complete type contracts in `types/inventory.ts` and `types/billing.ts`.

---

## Phase 1: Multi-Tenancy Data Isolation (Clerk + Supabase)
- [x] **1.1 Add Tenant Column (`org_id`)**:
  - Add `org_id TEXT NOT NULL` to `categories`, `inventory_items`, `stock_movements`, `customers`, `invoices`, and `invoice_items`.
  - Create index on `org_id` across all tables.
- [x] **1.2 Configure RLS with Clerk JWT Claims**:
  - Set up Supabase RLS policies using Clerk JWT template containing `org_id` (`(auth.jwt()->>'org_id') = org_id`).
- [x] **1.3 Tenant Context in Server Actions / API**:
  - Extract active `orgId` via `auth()` from `@clerk/nextjs/server` to enforce tenant scoping on all database queries.

---

## Phase 2: Inventory Catalog & Product Management
- [x] **2.1 Product Catalog View (`/inventory`)**:
  - Enterprise data table with dense row styling, column sorting, pagination, and search by SKU/name/barcode.
  - Quick filters: Category, Stock Status (In Stock, Low Stock, Out of Stock).
  - Stock badge indicators with customizable alert thresholds (`min_stock_alert`).
- [x] **2.2 Product Creation & Edit Dialog (`/inventory/new` or Modal)**:
  - Form fields: Item Code (SKU), Barcode, Product Name, Brand, Category, Description.
  - Pricing & Financials: Buy Price, Sell Price, Tax Rate (%), Auto-calculated Gross Margin (%).
  - Initial Stock & Minimum Stock Alert threshold.
- [x] **2.3 Dynamic Specifications Builder (`features JSONB`)**:
  - Key-value dynamic attribute editor (e.g., Color, Size, Material, Warranty, Expiry Date) stored directly in `features JSONB` without requiring schema migrations.
- [x] **2.4 Image Gallery Upload**:
  - Multi-image URL or Supabase Storage image uploader with primary thumbnail selection.

---

## Phase 3: Stock Movement & Audit Ledger
- [x] **3.1 Stock Adjustment Modal**:
  - Quick actions from the catalog: Restock (Purchase), Adjust (Count Reconciliation), Write-off (Damage/Expired), Return.
  - Reason and reference document inputs.
- [x] **3.2 Historical Stock Ledger View (`/inventory/[id]/movements`)**:
  - Immutable audit trail displaying timestamp, type, quantity change (+/-), before/after stock balance, and operator.

---

## Phase 4: Customer & Client Directory
- [x] **4.1 Customer Management Interface (`/customers`)**:
  - Customer directory with search by name, phone, email, or company.
  - Tax ID / GSTIN field for business accounts.
  - Structured billing and shipping address storage (`JSONB`).
- [x] **4.2 Customer Profile & Purchase History**:
  - View lifetime order volume, outstanding balances, and past invoices.

---

## Phase 5: Billing & Invoicing Engine
- [x] **5.1 Interactive Invoice Generator / POS (`/billing/new`)**:
  - Real-time product search with SKU/barcode scanner support.
  - Live stock availability validation (prevents selling unavailable stock).
  - Automatic line total calculation: `(unit_price * quantity) - discount + tax`.
  - Customer selection with auto-filling snapshot data.
- [x] **5.2 Automated Stock Deduction**:
  - Upon invoice confirmation, automatically decrement inventory `stock_quantity` and generate corresponding `sale` entries in `stock_movements`.
- [x] **5.3 Payment Recording**:
  - Payment method options: Cash, Card, UPI, Bank Transfer, Credit.
  - Payment status tracking (`draft`, `issued`, `paid`, `partially_paid`, `cancelled`).
- [x] **5.4 Invoice Management & Printable Receipts (`/billing/[id]`)**:
  - Clean, minimal printable invoice template.
  - Download / Export to PDF.

---

## Phase 6: Financial Analytics & Business Intelligence
- [x] **6.1 Dashboard Overview (`/dashboard`)**:
  - Summary metrics: Total Inventory Value (at Cost vs. at Retail), Total Revenue, Gross Profit Margin.
  - Low-stock and out-of-stock warning feed.
- [x] **6.2 Sales & Margin Reports**:
  - Top-selling items by revenue and unit volume.
  - Profit margin breakdown per category and product line.

---

## Phase 7: Role-Based Access Control (RBAC) & Clerk Roles Integration
- [x] **7.1 Native Clerk Organization Roles**:
  - `admin`: Full system access (margins, cost, product catalog, customer management, billing, deletions).
  - `manager`: Full operational access (inventory edits, stock movements, invoicing, customers; record deletion restricted).
  - `cashier`: POS billing & customer creation only (`/dashboard` restricted; buy price and margins hidden).
  - `member`: Dedicated operations staff:
    - **Inventory**: ONLY sales price is visible (`Cost` and `Margin` columns completely hidden). Cannot add/edit products or delete records.
    - **Stock Adjustments**: CAN adjust stock and reconcile inventory quantities (`Adjust` modal).
    - **Invoicing & Customers**: CAN generate POS invoices (`/billing/new`) and manage customer accounts (`/customers`).
    - **Oversimplified Dashboard**: Operational overview showing Total Retail Inventory, Total Sales Invoiced, Outstanding Receivables, and Stock Health Alerts. **Zero profit metrics, zero cost valuation, and zero margins shown**.
- [x] **7.2 Complete Data Masking & Route Guards**:
  - `buy_price` completely stripped to `0` at server level for `member` and `cashier` in [lib/rbac.ts](file:///c:/Users/jaisi/OneDrive/Desktop/inventra/lib/rbac.ts) and [lib/db/inventory.ts](file:///c:/Users/jaisi/OneDrive/Desktop/inventra/lib/db/inventory.ts).
  - Server-side analytics in [lib/db/analytics.ts](file:///c:/Users/jaisi/OneDrive/Desktop/inventra/lib/db/analytics.ts) automatically zeros out cost valuation and profit for `member`.
  - Route guards on `/inventory/new` redirecting unauthorized roles.
  - CSV exports automatically exclude Buy Price and Margins when viewed by `member` or `cashier`.
