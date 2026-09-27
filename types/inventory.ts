export interface Category {
  id: string;
  org_id: string;                             // Clerk Organization ID (Tenant)
  name: string;
  slug: string;
  parent_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryImage {
  url: string;
  alt?: string;
  is_primary?: boolean;
}

export type InventoryItemStatus = 'active' | 'inactive' | 'discontinued' | 'out_of_stock';

export interface InventoryItem {
  id: string;
  org_id: string;                             // Clerk Organization ID (Tenant)
  sku: string;                                // itemcode (SKU)
  barcode?: string | null;                    // optional barcode
  name: string;                               // product name
  description?: string | null;                // product description
  category_id?: string | null;
  category?: Category | null;
  brand?: string | null;
  unit: string;                               // pcs, kg, box, etc.
  buy_price: number;                          // buy price
  sell_price: number;                         // sell price
  tax_rate: number;                           // percentage e.g. 18.00
  stock_quantity: number;                     // stock quantity
  min_stock_alert: number;                    // low stock threshold
  max_stock_capacity?: number | null;
  location?: string | null;                   // warehouse rack/aisle
  status: InventoryItemStatus;
  images: InventoryImage[];                   // multi-image support
  features: Record<string, unknown>;          // arbitrary flexible features (color, size, material, warranty, etc.)
  metadata: Record<string, unknown>;          // supplier info, custom fields, internal tags
  created_at?: string;
  updated_at?: string;
}

export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage' | 'transfer';

export interface StockMovement {
  id: string;
  org_id: string;                             // Clerk Organization ID (Tenant)
  item_id: string;
  movement_type: MovementType;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  reference_type?: string | null;
  reference_id?: string | null;
  reason?: string | null;
  performed_by?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}
