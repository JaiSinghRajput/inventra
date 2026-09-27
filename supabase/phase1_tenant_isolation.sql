-- ==============================================================================
-- INVENTRA PHASE 1: MIGRATION SCRIPT FOR MULTI-TENANCY DATA ISOLATION
-- Run this script in your Supabase SQL Editor if you already applied the initial schema.
-- ==============================================================================

-- 1. Add org_id to existing tables (with temporary fallback default for existing rows)
DO $$
BEGIN
    -- categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'org_id') THEN
        ALTER TABLE public.categories ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default_org';
        ALTER TABLE public.categories ALTER COLUMN org_id DROP DEFAULT;
    END IF;

    -- inventory_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'org_id') THEN
        ALTER TABLE public.inventory_items ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default_org';
        ALTER TABLE public.inventory_items ALTER COLUMN org_id DROP DEFAULT;
    END IF;

    -- stock_movements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'org_id') THEN
        ALTER TABLE public.stock_movements ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default_org';
        ALTER TABLE public.stock_movements ALTER COLUMN org_id DROP DEFAULT;
    END IF;

    -- customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'org_id') THEN
        ALTER TABLE public.customers ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default_org';
        ALTER TABLE public.customers ALTER COLUMN org_id DROP DEFAULT;
    END IF;

    -- invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'org_id') THEN
        ALTER TABLE public.invoices ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default_org';
        ALTER TABLE public.invoices ALTER COLUMN org_id DROP DEFAULT;
    END IF;

    -- invoice_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_items' AND column_name = 'org_id') THEN
        ALTER TABLE public.invoice_items ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default_org';
        ALTER TABLE public.invoice_items ALTER COLUMN org_id DROP DEFAULT;
    END IF;
END $$;

-- 2. Update Constraints to be Tenant-Scoped
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS uq_categories_org_slug;
ALTER TABLE public.categories ADD CONSTRAINT uq_categories_org_slug UNIQUE (org_id, slug);

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_key;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_barcode_key;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS uq_inventory_items_org_sku;
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS uq_inventory_items_org_barcode;
ALTER TABLE public.inventory_items ADD CONSTRAINT uq_inventory_items_org_sku UNIQUE (org_id, sku);
ALTER TABLE public.inventory_items ADD CONSTRAINT uq_inventory_items_org_barcode UNIQUE (org_id, barcode);

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS uq_invoices_org_invoice_number;
ALTER TABLE public.invoices ADD CONSTRAINT uq_invoices_org_invoice_number UNIQUE (org_id, invoice_number);

-- 3. Create Tenant Performance Indexes
CREATE INDEX IF NOT EXISTS idx_categories_org_id ON public.categories(org_id);
CREATE INDEX IF NOT EXISTS idx_categories_org_slug ON public.categories(org_id, slug);

CREATE INDEX IF NOT EXISTS idx_inventory_items_org_id ON public.inventory_items(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_sku ON public.inventory_items(org_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_category ON public.inventory_items(org_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org_status ON public.inventory_items(org_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON public.inventory_items(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org_id ON public.stock_movements(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_item ON public.stock_movements(org_id, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_org_id ON public.customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(org_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(org_id, phone);

CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_number ON public.invoices(org_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_issue_date ON public.invoices(org_id, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_items_org_id ON public.invoice_items(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org_invoice ON public.invoice_items(org_id, invoice_id);

-- 4. Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies
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

DROP POLICY IF EXISTS "Tenant isolation for categories" ON public.categories;
DROP POLICY IF EXISTS "Tenant isolation for inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Tenant isolation for stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Tenant isolation for customers" ON public.customers;
DROP POLICY IF EXISTS "Tenant isolation for invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant isolation for invoice items" ON public.invoice_items;

-- 6. Create Clerk JWT Tenant Isolation Policies
CREATE POLICY "Tenant isolation for categories"
    ON public.categories
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

CREATE POLICY "Tenant isolation for inventory items"
    ON public.inventory_items
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

CREATE POLICY "Tenant isolation for stock movements"
    ON public.stock_movements
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

CREATE POLICY "Tenant isolation for customers"
    ON public.customers
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

CREATE POLICY "Tenant isolation for invoices"
    ON public.invoices
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

CREATE POLICY "Tenant isolation for invoice items"
    ON public.invoice_items
    FOR ALL
    TO authenticated
    USING (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')))
    WITH CHECK (org_id = (SELECT COALESCE(auth.jwt()->>'org_id', auth.jwt()->'app_metadata'->>'org_id')));

-- 7. Grant Table Privileges
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoice_items TO authenticated;
