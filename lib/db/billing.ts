"use server";

import { getTenantContext } from "@/lib/tenant";
import { Customer, Invoice, InvoiceItem, InvoiceStatus } from "@/types/billing";
import { resolveUserRole, getPermissions } from "@/lib/rbac";

/**
 * Fetches all customers belonging to the currently active tenant organization.
 */
export async function fetchCustomers(): Promise<Customer[]> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message || JSON.stringify(error));
  return (data || []) as Customer[];
}

/**
 * Creates a new customer within the active tenant organization.
 */
export async function createCustomer(
  customer: Omit<Customer, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Customer> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("customers")
    .insert([
      {
        org_id: orgId,
        name: customer.name,
        email: customer.email || null,
        phone: customer.phone || null,
        company_name: customer.company_name || null,
        tax_id: customer.tax_id || null,
        billing_address: customer.billing_address || {},
        shipping_address: customer.shipping_address || {},
        notes: customer.notes || null,
        metadata: customer.metadata || {},
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as Customer;
}

/**
 * Fetches all invoices belonging to the currently active tenant organization.
 */
export async function fetchInvoices(): Promise<Invoice[]> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(*), items:invoice_items(*)")
    .eq("org_id", orgId)
    .order("issue_date", { ascending: false });

  if (error) throw new Error(error.message || JSON.stringify(error));
  return (data || []) as Invoice[];
}

/**
 * Fetches a single invoice by ID scoped to the active tenant organization.
 */
export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(*), items:invoice_items(*)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as Invoice | null;
}

/**
 * Creates an invoice and its line items strictly scoped to the active tenant organization,
 * decrementing stock and recording stock movement audit entries per tenant.
 */
export async function createInvoiceWithItems(
  invoice: Omit<Invoice, "id" | "org_id" | "created_at" | "updated_at" | "items">,
  items: Omit<InvoiceItem, "id" | "org_id" | "invoice_id" | "created_at">[]
): Promise<Invoice> {
  const { orgId, supabase } = await getTenantContext();

  // 1. Insert Invoice with tenant org_id
  const { data: invData, error: invError } = await supabase
    .from("invoices")
    .insert([
      {
        ...invoice,
        org_id: orgId,
      },
    ])
    .select()
    .single();

  if (invError) throw new Error(invError.message || JSON.stringify(invError));

  // 2. Insert Invoice Items with tenant org_id
  if (items.length > 0) {
    const itemsWithTenant = items.map((it) => ({
      ...it,
      org_id: orgId,
      invoice_id: invData.id,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemsWithTenant);

    if (itemsError) throw new Error(itemsError.message || JSON.stringify(itemsError));

    // 3. Atomically update inventory and log movement per tenant item
    for (const line of items) {
      if (line.item_id) {
        // Fetch current item stock scoped to tenant
        const { data: itemData } = await supabase
          .from("inventory_items")
          .select("stock_quantity")
          .eq("org_id", orgId)
          .eq("id", line.item_id)
          .single();

        if (itemData) {
          const newStock = Math.max(0, itemData.stock_quantity - line.quantity);
          await supabase
            .from("inventory_items")
            .update({ stock_quantity: newStock })
            .eq("org_id", orgId)
            .eq("id", line.item_id);

          await supabase.from("stock_movements").insert([
            {
              org_id: orgId,
              item_id: line.item_id,
              movement_type: "sale",
              quantity_change: -line.quantity,
              stock_before: itemData.stock_quantity,
              stock_after: newStock,
              reference_type: "invoice",
              reference_id: invData.invoice_number,
              reason: `Sale on invoice ${invData.invoice_number}`,
            },
          ]);
        }
      }
    }
  }

  return invData as Invoice;
}

/**
 * Updates the payment/operational status of an invoice.
 */
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  amountPaid?: number
): Promise<Invoice> {
  const { orgId, supabase } = await getTenantContext();

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (amountPaid !== undefined) {
    updates.amount_paid = amountPaid;
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("*, customer:customers(*), items:invoice_items(*)")
    .single();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as Invoice;
}

/**
 * Deletes an invoice and its items (scoped strictly to tenant).
 */
export async function deleteInvoice(id: string): Promise<void> {
  const { orgId, supabase } = await getTenantContext();

  // Delete invoice items first (if cascade isn't guaranteed)
  await supabase.from("invoice_items").delete().eq("org_id", orgId).eq("invoice_id", id);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message || JSON.stringify(error));
}

/**
 * Generates the next sequential invoice number scoped to the tenant organization.
 */
export async function generateNextInvoiceNumber(): Promise<string> {
  const { orgId, supabase } = await getTenantContext();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("org_id", orgId)
    .ilike("invoice_number", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0 && data[0].invoice_number) {
    const lastNumStr = data[0].invoice_number.replace(prefix, "");
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
    }
  }

  // Count total fallback
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const nextSeq = (count || 0) + 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Fetches a single customer by ID scoped strictly to the active tenant organization.
 */
export async function fetchCustomerById(id: string): Promise<Customer | null> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as Customer | null;
}

/**
 * Updates a customer record scoped strictly to the active tenant organization.
 */
export async function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, "id" | "org_id" | "created_at" | "updated_at">>
): Promise<Customer> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message || JSON.stringify(error));
  return data as Customer;
}

/**
 * Deletes a customer record scoped strictly to the active tenant organization.
 */
export async function deleteCustomer(id: string): Promise<void> {
  const { orgId, orgRole, supabase } = await getTenantContext();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);
  if (!permissions.canDeleteRecords) {
    throw new Error("PERMISSION_DENIED: Only administrators can permanently delete customer records.");
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message || JSON.stringify(error));
}

/**
 * Fetches all invoices and lifetime purchasing history for a specific customer.
 */
export async function fetchCustomerInvoices(customerId: string): Promise<Invoice[]> {
  const { orgId, supabase } = await getTenantContext();

  const { data, error } = await supabase
    .from("invoices")
    .select("*, items:invoice_items(*)")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("issue_date", { ascending: false });

  if (error) throw new Error(error.message || JSON.stringify(error));
  return (data || []) as Invoice[];
}

/**
 * Seeds realistic enterprise client profiles for the active tenant organization.
 */
export async function seedSampleCustomers(): Promise<void> {
  const { orgId, supabase } = await getTenantContext();

  const sampleCustomers = [
    {
      name: "Alex Rivera",
      company_name: "Apex HyperScale Technologies Inc.",
      email: "arivera@apexscale.io",
      phone: "+1 (555) 349-8201",
      tax_id: "US-EIN-94-8291048",
      billing_address: {
        street: "100 Innovation Way, Suite 400",
        city: "San Francisco",
        state: "CA",
        postal_code: "94107",
        country: "USA",
      },
      shipping_address: {
        street: "Warehouse Dock 4, 100 Innovation Way",
        city: "San Francisco",
        state: "CA",
        postal_code: "94107",
        country: "USA",
      },
      notes: "VIP Enterprise account. Net-30 payment terms.",
      metadata: { segment: "Tier-1 Enterprise", account_manager: "Sarah Jenkins" },
    },
    {
      name: "Elena Rostova",
      company_name: "Nordic Logistics & Freight AB",
      email: "elena.rostova@nordicfreight.eu",
      phone: "+46 8 123 456 78",
      tax_id: "SE556012345601",
      billing_address: {
        street: "Hamngatan 15",
        city: "Stockholm",
        state: "Stockholm",
        postal_code: "111 47",
        country: "Sweden",
      },
      shipping_address: {
        street: "Terminal 2, Frihamnen",
        city: "Stockholm",
        state: "Stockholm",
        postal_code: "115 56",
        country: "Sweden",
      },
      notes: "Requires EU reverse charge VAT handling on electronic exports.",
      metadata: { segment: "Logistics Partner" },
    },
    {
      name: "Marcus Vance",
      company_name: "Vance Design Studio",
      email: "marcus@vancestudio.design",
      phone: "+1 (555) 782-9912",
      tax_id: "US-EIN-12-3456789",
      billing_address: {
        street: "42 Mercer Street, Floor 3",
        city: "New York",
        state: "NY",
        postal_code: "10013",
        country: "USA",
      },
      shipping_address: {
        street: "42 Mercer Street, Floor 3",
        city: "New York",
        state: "NY",
        postal_code: "10013",
        country: "USA",
      },
      notes: "Architectural & Interior Design client. Orders ergonomic workstations.",
      metadata: { segment: "Creative Agency" },
    },
    {
      name: "Priya Sharma",
      company_name: "Zenith Retail Chains Pvt Ltd",
      email: "priya.sharma@zenithretail.in",
      phone: "+91 98201 54321",
      tax_id: "27AABCZ1234F1Z8",
      billing_address: {
        street: "Tower B, Level 14, Cyber Hub",
        city: "Gurugram",
        state: "Haryana",
        postal_code: "122002",
        country: "India",
      },
      shipping_address: {
        street: "Distribution Hub North, NH-48",
        city: "Gurugram",
        state: "Haryana",
        postal_code: "122004",
        country: "India",
      },
      notes: "GST registered entity. Bulk pallet shipping.",
      metadata: { segment: "B2B Retail Chains" },
    },
  ];

  for (const cust of sampleCustomers) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", cust.email)
      .maybeSingle();

    if (!existing) {
      const { data: createdCust } = await supabase
        .from("customers")
        .insert([{ org_id: orgId, ...cust }])
        .select()
        .single();

      // Create a sample historical invoice for demoing order volume & purchase history
      if (createdCust && cust.company_name.includes("Apex")) {
        await supabase.from("invoices").insert([
          {
            org_id: orgId,
            invoice_number: "INV-2026-0001",
            customer_id: createdCust.id,
            customer_details: {
              name: createdCust.name,
              company: createdCust.company_name,
              email: createdCust.email,
              tax_id: createdCust.tax_id,
            },
            issue_date: "2026-09-15",
            due_date: "2026-10-15",
            status: "paid",
            subtotal: 1250.00,
            discount_type: "percentage",
            discount_value: 5.00,
            tax_total: 213.75,
            total_amount: 1401.25,
            amount_paid: 1401.25,
            payment_method: "bank_transfer",
            payment_notes: "Wire transfer ref #WT-89410294",
          },
        ]);
      } else if (createdCust && cust.company_name.includes("Nordic")) {
        await supabase.from("invoices").insert([
          {
            org_id: orgId,
            invoice_number: "INV-2026-0002",
            customer_id: createdCust.id,
            customer_details: {
              name: createdCust.name,
              company: createdCust.company_name,
              email: createdCust.email,
              tax_id: createdCust.tax_id,
            },
            issue_date: "2026-09-22",
            due_date: "2026-10-22",
            status: "issued",
            subtotal: 680.00,
            discount_type: "fixed",
            discount_value: 0.00,
            tax_total: 122.40,
            total_amount: 802.40,
            amount_paid: 0.00, // OUTSTANDING BALANCE
            payment_method: "credit",
            payment_notes: "Net 30 invoice pending payment",
          },
        ]);
      }
    }
  }
}

