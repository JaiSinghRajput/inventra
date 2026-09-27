"use server";

import { getTenantContext } from "@/lib/tenant";
import { Category, InventoryItem, StockMovement } from "@/types/inventory";
import { resolveUserRole, getPermissions, maskSensitiveItemList, maskSensitiveItemData } from "@/lib/rbac";

/**
 * Fetches all categories belonging to the currently active tenant organization.
 */
export async function fetchCategories(): Promise<Category[]> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message || JSON.stringify(error));
  return (data || []) as Category[];
}

/**
 * Creates a new category within the active tenant organization.
 */
export async function createCategory(
  category: Omit<Category, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Category> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canEditInventory) {
    throw new Error("PERMISSION_DENIED: Your role does not allow creating categories.");
  }

  const { data, error } = await supabase
    .from("categories")
    .insert([
      {
        org_id: orgId,
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id || null,
        description: category.description || null,
        metadata: category.metadata || {},
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as Category;
}

/**
 * Fetches all inventory items belonging to the currently active tenant organization.
 * Cashier role automatically receives masked cost prices.
 */
export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, category:categories(*)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || JSON.stringify(error));
  const items = (data || []) as InventoryItem[];
  return maskSensitiveItemList(items, role);
}

/**
 * Fetches a single inventory item by SKU scoped to the active tenant organization.
 */
export async function fetchItemBySku(sku: string): Promise<InventoryItem | null> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, category:categories(*)")
    .eq("org_id", orgId)
    .eq("sku", sku)
    .maybeSingle();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data ? maskSensitiveItemData(data as InventoryItem, role) : null;
}

/**
 * Fetches a single inventory item by ID scoped to the active tenant organization.
 */
export async function fetchItemById(id: string): Promise<InventoryItem | null> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, category:categories(*)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data ? maskSensitiveItemData(data as InventoryItem, role) : null;
}

/**
 * Inserts a new inventory item strictly scoped to the active tenant organization.
 */
export async function insertInventoryItem(
  item: Omit<InventoryItem, "id" | "org_id" | "created_at" | "updated_at">
): Promise<InventoryItem> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canEditInventory) {
    throw new Error("PERMISSION_DENIED: Your role does not allow adding inventory products.");
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .insert([
      {
        org_id: orgId,
        sku: item.sku,
        barcode: item.barcode || null,
        name: item.name,
        description: item.description || null,
        category_id: item.category_id || null,
        brand: item.brand || null,
        unit: item.unit || "pcs",
        buy_price: item.buy_price,
        sell_price: item.sell_price,
        tax_rate: item.tax_rate || 0,
        stock_quantity: item.stock_quantity || 0,
        min_stock_alert: item.min_stock_alert || 5,
        max_stock_capacity: item.max_stock_capacity || null,
        location: item.location || null,
        status: item.status || "active",
        images: item.images || [],
        features: item.features || {},
        metadata: item.metadata || {},
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as InventoryItem;
}

/**
 * Updates an inventory item scoped to the active tenant organization.
 */
export async function updateInventoryItem(
  id: string,
  updates: Partial<Omit<InventoryItem, "id" | "org_id" | "created_at" | "updated_at">>
): Promise<InventoryItem> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canEditInventory) {
    throw new Error("PERMISSION_DENIED: Your role does not allow editing inventory products.");
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .update(updates)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as InventoryItem;
}

/**
 * Records a stock movement audit entry and updates current stock level,
 * scoped strictly to the active tenant organization.
 */
export async function recordStockMovement(
  movement: Omit<StockMovement, "id" | "org_id" | "created_at">
): Promise<StockMovement> {
  const { userId, orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canAdjustStock) {
    throw new Error("PERMISSION_DENIED: Your role does not allow adjusting stock levels.");
  }

  // 1. Log movement entry scoped to tenant
  const { data: movementData, error: moveError } = await supabase
    .from("stock_movements")
    .insert([
      {
        org_id: orgId,
        item_id: movement.item_id,
        movement_type: movement.movement_type,
        quantity_change: movement.quantity_change,
        stock_before: movement.stock_before,
        stock_after: movement.stock_after,
        reference_type: movement.reference_type || null,
        reference_id: movement.reference_id || null,
        reason: movement.reason || null,
        performed_by: movement.performed_by || userId,
        metadata: movement.metadata || {},
      },
    ])
    .select()
    .single();

  if (moveError) throw new Error(moveError.message || JSON.stringify(moveError));

  // 2. Update current stock in inventory item scoped to tenant
  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ stock_quantity: movement.stock_after })
    .eq("org_id", orgId)
    .eq("id", movement.item_id);

  if (updateError) throw new Error(updateError.message || JSON.stringify(updateError));

  return movementData as StockMovement;
}

/**
 * Fetches all historical stock movements for a specific item,
 * sorted by created_at DESC (immutable audit ledger).
 */
export async function fetchStockMovementsByItemId(
  itemId: string
): Promise<StockMovement[]> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("org_id", orgId)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || JSON.stringify(error));
  return (data || []) as StockMovement[];
}


/**
 * Deletes an inventory item scoped strictly to the active tenant organization.
 */
export async function deleteInventoryItem(id: string): Promise<void> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canDeleteRecords) {
    throw new Error("PERMISSION_DENIED: Only administrators can permanently delete inventory catalog items.");
  }

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message || JSON.stringify(error));
}

/**
 * Seeds realistic enterprise demo products for the active tenant.
 */
export async function seedSampleInventoryItems(): Promise<void> {
  const { orgId, supabase } = await getTenantContext();

  // 1. Ensure demo categories exist
  const categoriesData = [
    { name: "Electronics & Peripherals", slug: "electronics", description: "Computing hardware, displays, and gadgets" },
    { name: "Office Furniture", slug: "office-furniture", description: "Desks, ergonomic seating, and storage" },
    { name: "Warehouse & Logistics", slug: "warehouse-logistics", description: "Racks, bins, and shipping supplies" },
  ];

  const categoryMap = new Map<string, string>();

  for (const cat of categoriesData) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("org_id", orgId)
      .eq("slug", cat.slug)
      .maybeSingle();

    if (existing) {
      categoryMap.set(cat.slug, existing.id);
    } else {
      const { data: inserted } = await supabase
        .from("categories")
        .insert([{ org_id: orgId, ...cat }])
        .select("id")
        .single();
      if (inserted) categoryMap.set(cat.slug, inserted.id);
    }
  }

  // 2. Demo Inventory Items
  const sampleItems = [
    {
      sku: "ELEC-KB-901",
      barcode: "8901234567890",
      name: "Nova Wireless Mechanical Keyboard (RGB)",
      description: "Hot-swappable tactile switches, gasket mounted, tri-mode connectivity (2.4GHz, BT 5.2, USB-C).",
      category_id: categoryMap.get("electronics") || null,
      brand: "KeyPulse",
      unit: "pcs",
      buy_price: 68.00,
      sell_price: 119.00,
      tax_rate: 18.00,
      stock_quantity: 42,
      min_stock_alert: 10,
      max_stock_capacity: 100,
      location: "Warehouse A, Bin 12-C",
      status: "active" as const,
      images: [
        {
          url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
          alt: "Nova Mechanical Keyboard Top View",
          is_primary: true,
        },
      ],
      features: {
        Switch: "Tactile Brown",
        Connectivity: "Tri-mode (BT/2.4G/USB-C)",
        Battery: "4000mAh Lithium",
        Keycaps: "Double-shot PBT",
        Warranty: "2 Years",
      },
      metadata: { supplier: "KeyPulse Ltd", restock_lead_days: 7 },
    },
    {
      sku: "ELEC-MON-4K27",
      barcode: "8901234567891",
      name: "UltraView 27-inch 4K IPS HDR Monitor",
      description: "Factory calibrated 99% sRGB color gamut, 90W USB-C power delivery, pivot adjustable stand.",
      category_id: categoryMap.get("electronics") || null,
      brand: "ViewMaster",
      unit: "pcs",
      buy_price: 240.00,
      sell_price: 389.00,
      tax_rate: 18.00,
      stock_quantity: 4, // LOW STOCK TRIGGER (alert is 5)
      min_stock_alert: 5,
      max_stock_capacity: 30,
      location: "Warehouse A, Aisle 3-D",
      status: "active" as const,
      images: [
        {
          url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
          alt: "UltraView 4K Monitor",
          is_primary: true,
        },
      ],
      features: {
        Resolution: "3840 x 2160 UHD",
        RefreshRate: "60Hz",
        Panel: "IPS Anti-glare",
        ColorGamut: "99% sRGB, 95% DCI-P3",
        PowerDelivery: "90W USB-C",
      },
      metadata: { supplier: "DisplayTech Corp", box_dimensions: "72x48x18cm" },
    },
    {
      sku: "FURN-CHR-ERGO",
      barcode: "8901234567892",
      name: "ErgoFlow Executive Mesh Task Chair",
      description: "Dynamic lumbar support, 4D armrests, breathable Korean high-tensile elastomer mesh.",
      category_id: categoryMap.get("office-furniture") || null,
      brand: "AeroPosture",
      unit: "pcs",
      buy_price: 185.00,
      sell_price: 349.00,
      tax_rate: 18.00,
      stock_quantity: 18,
      min_stock_alert: 6,
      max_stock_capacity: 50,
      location: "Warehouse B, Section 1",
      status: "active" as const,
      images: [
        {
          url: "https://images.unsplash.com/photo-1580481077195-c3a821a58875?auto=format&fit=crop&w=600&q=80",
          alt: "ErgoFlow Task Chair",
          is_primary: true,
        },
      ],
      features: {
        Material: "Korean Mesh & Aluminum",
        MaxWeight: "150 kg",
        Armrests: "4D Adjustable",
        Recline: "90° to 135° with lock",
        Warranty: "5 Years",
      },
      metadata: { b2b_discount_eligible: true },
    },
    {
      sku: "ELEC-DOCK-12P",
      barcode: "8901234567893",
      name: "OmniHub 12-in-1 Triple Display Thunderbolt Dock",
      description: "Dual 4K HDMI + DisplayPort, Gigabit Ethernet, 100W PD passthrough, SD/TF card reader.",
      category_id: categoryMap.get("electronics") || null,
      brand: "HubTech",
      unit: "pcs",
      buy_price: 52.00,
      sell_price: 99.00,
      tax_rate: 18.00,
      stock_quantity: 0, // OUT OF STOCK TRIGGER
      min_stock_alert: 8,
      max_stock_capacity: 80,
      location: "Warehouse A, Bin 04-A",
      status: "out_of_stock" as const,
      images: [
        {
          url: "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=600&q=80",
          alt: "OmniHub Docking Station",
          is_primary: true,
        },
      ],
      features: {
        Ports: "12 Ports",
        PowerDelivery: "100W",
        DisplayOutputs: "2x HDMI 4K + 1x DP",
        Ethernet: "1000 Mbps RJ45",
        Chassis: "Anodized Aluminum",
      },
      metadata: { status: "Awaiting next batch shipment" },
    },
    {
      sku: "LOG-RCK-HD1000",
      barcode: "8901234567894",
      name: "Heavy-Duty 4-Tier Industrial Steel Shelving Rack",
      description: "Commercial powder-coated steel racking, 1000kg distributed load capacity per shelf.",
      category_id: categoryMap.get("warehouse-logistics") || null,
      brand: "IronHold",
      unit: "unit",
      buy_price: 130.00,
      sell_price: 220.00,
      tax_rate: 18.00,
      stock_quantity: 15,
      min_stock_alert: 4,
      max_stock_capacity: 40,
      location: "Warehouse Yard, Bay 2",
      status: "active" as const,
      images: [
        {
          url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80",
          alt: "Industrial Steel Shelving",
          is_primary: true,
        },
      ],
      features: {
        Capacity: "4000 kg total (1000kg/tier)",
        Dimensions: "200cm H x 180cm W x 60cm D",
        Coating: "Corrosion-resistant epoxy",
        Assembly: "Boltless lock-in pins",
      },
      metadata: { forklift_accessible: true },
    },
  ];

  for (const item of sampleItems) {
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("org_id", orgId)
      .eq("sku", item.sku)
      .maybeSingle();

    if (!existing) {
      await supabase
        .from("inventory_items")
        .insert([{ org_id: orgId, ...item }]);
    }
  }
}


