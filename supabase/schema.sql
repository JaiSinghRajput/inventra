-- ==============================================================================
-- INVENTRA INVENTORY & BILLING SYSTEM SCHEMA
-- Multi-Tenant Architecture with Clerk Authentication & Supabase RLS
-- PostgreSQL Best Practices (Data Isolation, Performance Indexes, JSONB)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CATEGORIES TABLE
-- Supports nested hierarchical categories scoped per tenant organization
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                                           -- Clerk Organization ID (Tenant)
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_categories_org_slug UNIQUE (org_id, slug)
);

-- Performance & Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_categories_org_id ON public.categories(org_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_org_slug ON public.categories(org_id, slug);

-- ==============================================================================
-- 3. INVENTORY ITEMS TABLE (TENANT ISOLATED + DYNAMIC SPECS)
-- Supports arbitrary dynamic attributes via JSONB `features` and `metadata`,
-- multi-image galleries via `images` JSONB, pricing, stock levels, and SKUs.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                                           -- Clerk Organization ID (Tenant)
    sku TEXT NOT NULL,                                              -- Item Code / SKU (unique per org)
    barcode TEXT,                                                   -- EAN / UPC / Barcode (unique per org)
    name TEXT NOT NULL,                                             -- Product Name
    description TEXT,                                               -- Detailed description
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    brand TEXT,                                                     -- Brand or Manufacturer
    unit TEXT NOT NULL DEFAULT 'pcs',                              -- pcs, kg, box, meter, liter
    buy_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (buy_price >= 0),
    sell_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (sell_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    max_stock_capacity INTEGER CHECK (max_stock_capacity IS NULL OR max_stock_capacity >= stock_quantity),
    location TEXT,                                                  -- Warehouse location / Shelf / Aisle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued', 'out_of_stock')),
    images JSONB NOT NULL DEFAULT '[]'::jsonb,                     -- Array of image objects [{url, alt, is_primary}]
    features JSONB NOT NULL DEFAULT '{}'::jsonb,                   -- Dynamic specs: color, size, material, warranty, expiry
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                   -- Extensible vendor details, custom attributes, tags
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_inventory_items_org_sku UNIQUE (org_id, sku),
    CONSTRAINT uq_inventory_items_org_barcode UNIQUE (org_id, barcode)
);

-- Essential Performance & Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_id ON public.inventory_items(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_id ON public.inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_sku ON public.inventory_items(org_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_category ON public.inventory_items(org_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_status ON public.inventory_items(org_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON public.inventory_items(org_id, created_at DESC);

-- GIN Indexes for Lightning-Fast JSONB Queries on Flexible Features & Metadata
CREATE INDEX IF NOT EXISTS idx_inventory_items_features ON public.inventory_items USING gin (features);
CREATE INDEX IF NOT EXISTS idx_inventory_items_metadata ON public.inventory_items USING gin (metadata);

-- ==============================================================================
-- 4. STOCK MOVEMENTS TABLE (AUDIT TRAIL & HISTORY)
-- Tracks every change to stock levels (sales, restocks, damages, manual adjustments)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                                           -- Clerk Organization ID (Tenant)
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return', 'damage', 'transfer')),
    quantity_change INTEGER NOT NULL,                              -- e.g. +50 or -5
    stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
    stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
    reference_type TEXT,                                           -- 'invoice', 'purchase_order', 'audit'
    reference_id TEXT,                                             -- Document number
    reason TEXT,
    performed_by TEXT,                                             -- User identifier / email
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_id ON public.stock_movements(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_item ON public.stock_movements(org_id, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(org_id, created_at DESC);

-- ==============================================================================
-- 5. CUSTOMERS TABLE (FOR BILLING & INVOICING)
-- Scoped per tenant organization
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                                           -- Clerk Organization ID (Tenant)
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    tax_id TEXT,                                                   -- GSTIN, VAT, Tax ID
    billing_address JSONB DEFAULT '{}'::jsonb,                     -- {street, city, state, zip, country}
    shipping_address JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,                            -- Custom client properties
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customers_org_id ON public.customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(org_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(org_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_metadata ON public.customers USING gin (metadata);

-- ==============================================================================
-- 6. INVOICES TABLE (BILLING SYSTEM HEADER)
-- Scoped per tenant organization
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                                           -- Clerk Organization ID (Tenant)
    invoice_number TEXT NOT NULL,                                  -- e.g. INV-2026-0001 (unique per org)
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_details JSONB NOT NULL DEFAULT '{}'::jsonb,          -- Snapshot of customer info at invoice creation
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'partially_paid', 'cancelled', 'refunded')),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(12, 2) DEFAULT 0.00 CHECK (discount_value >= 0),
    tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'credit', 'other')),
    payment_notes TEXT,
    terms_and_conditions TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,                            -- Extensible invoice custom fields
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_invoices_org_invoice_number UNIQUE (org_id, invoice_number)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_number ON public.invoices(org_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_issue_date ON public.invoices(org_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_metadata ON public.invoices USING gin (metadata);

-- ==============================================================================
-- 7. INVOICE ITEMS TABLE (LINE ITEMS & INVENTORY LINK)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,                                           -- Clerk Organization ID (Tenant)
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,                                       -- Snapshot of name
    sku TEXT,                                                      -- Snapshot of SKU
    description TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    buy_price NUMERIC(12, 2) DEFAULT 0.00 CHECK (buy_price >= 0), -- Margin snapshot for profit calculation
    tax_rate NUMERIC(5, 2) DEFAULT 0.00 CHECK (tax_rate >= 0),
    tax_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (tax_amount >= 0),
    discount_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (discount_amount >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    features JSONB DEFAULT '{}'::jsonb,                           -- Custom specs of item sold
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_id ON public.invoice_items(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON public.invoice_items(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_invoice ON public.invoice_items(org_id, invoice_id);

-- ==============================================================================
-- 8. AUTOMATIC UPDATED_AT TIMESTAMP FUNCTION & TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON public.categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER trigger_inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON public.invoices;
CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON public.customers;
CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES — CLERK JWT TENANT ISOLATION
-- Evaluates Clerk JWT claims for org_id:
--   auth.jwt()->>'org_id' OR auth.jwt()->'app_metadata'->>'org_id'
-- Subquery wrapped `(SELECT ...)` pattern for 100x query performance caching.
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Drop legacy open policies if they exist
DROP POLICY IF EXISTS "Public Read Categories" ON public.categories;
DROP POLICY IF EXISTS "Public Write Categories" ON public.categories;
DROP POLICY IF EXISTS "Public Read Inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Public Write Inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Public Read Stock Movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Public Write Stock Movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Public Read Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Write Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Read Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public Write Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public Read Invoice Items" ON public.invoice_items;
DROP POLICY IF EXISTS "Public Write Invoice Items" ON public.invoice_items;

-- 9.1 CATEGORIES POLICIES
CREATE POLICY "Tenant isolation for categories"
    ON public.categories
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- 9.2 INVENTORY ITEMS POLICIES
CREATE POLICY "Tenant isolation for inventory items"
    ON public.inventory_items
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- 9.3 STOCK MOVEMENTS POLICIES
CREATE POLICY "Tenant isolation for stock movements"
    ON public.stock_movements
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- 9.4 CUSTOMERS POLICIES
CREATE POLICY "Tenant isolation for customers"
    ON public.customers
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- 9.5 INVOICES POLICIES
CREATE POLICY "Tenant isolation for invoices"
    ON public.invoices
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- 9.6 INVOICE ITEMS POLICIES
CREATE POLICY "Tenant isolation for invoice items"
    ON public.invoice_items
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- Grant privileges to authenticated role
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoice_items TO authenticated;
