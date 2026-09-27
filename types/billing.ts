export interface Customer {
  id: string;
  org_id: string;                             // Clerk Organization ID (Tenant)
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  tax_id?: string | null;                      // GSTIN, VAT, etc.
  billing_address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  shipping_address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'credit' | 'other';

export interface InvoiceItem {
  id: string;
  org_id: string;                             // Clerk Organization ID (Tenant)
  invoice_id: string;
  item_id?: string | null;
  item_name: string;
  sku?: string | null;
  description?: string | null;
  quantity: number;
  unit_price: number;
  buy_price: number;                          // for calculating profit margin
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
  features?: Record<string, unknown>;         // snapshot of customized specs sold
  created_at?: string;
}

export interface Invoice {
  id: string;
  org_id: string;                             // Clerk Organization ID (Tenant)
  invoice_number: string;
  customer_id?: string | null;
  customer?: Customer | null;
  customer_details: Record<string, unknown>;
  issue_date: string;
  due_date?: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value: number;
  tax_total: number;
  total_amount: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  payment_notes?: string | null;
  terms_and_conditions?: string | null;
  metadata?: Record<string, unknown>;
  items?: InvoiceItem[];
  created_at?: string;
  updated_at?: string;
}
