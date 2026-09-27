/**
 * Role-Based Access Control (RBAC) for Inventra Enterprise.
 * Directly integrates with Clerk Organization Roles (Admin, Manager, Cashier, Member).
 */

export type AppRole = "admin" | "manager" | "cashier" | "member";

export interface RolePermissions {
  canViewCosts: boolean;
  canViewMargins: boolean;
  canViewProfits: boolean;
  canEditInventory: boolean;
  canAdjustStock: boolean;
  canManageInvoices: boolean;
  canManageCustomers: boolean;
  canViewExecutiveAnalytics: boolean;
  canDeleteRecords: boolean;
}

/**
 * Normalizes Clerk Organization role string to an AppRole.
 * Handles Clerk's standard keys: "org:admin", "org:manager", "org:cashier", "org:member"
 * as well as raw strings "admin", "manager", "cashier", "member".
 */
export function resolveUserRole(clerkRole?: string | null): AppRole {
  if (!clerkRole) return "admin"; // Default for solo workspace owner/creator without org membership

  const normalized = clerkRole.toLowerCase().trim();

  if (normalized === "org:admin" || normalized === "admin" || normalized.includes("admin")) {
    return "admin";
  }

  if (normalized === "org:cashier" || normalized === "cashier" || normalized.includes("cashier")) {
    return "cashier";
  }

  if (normalized === "org:manager" || normalized === "manager" || normalized.includes("manager")) {
    return "manager";
  }

  if (normalized === "org:member" || normalized === "member" || normalized.includes("member")) {
    return "member";
  }

  return "member";
}

/**
 * Returns the exact permission matrix for a given Clerk role.
 */
export function getPermissions(role: AppRole): RolePermissions {
  switch (role) {
    case "admin":
      return {
        canViewCosts: true,
        canViewMargins: true,
        canViewProfits: true,
        canEditInventory: true,
        canAdjustStock: true,
        canManageInvoices: true,
        canManageCustomers: true,
        canViewExecutiveAnalytics: true,
        canDeleteRecords: true,
      };

    case "manager":
      return {
        canViewCosts: true,
        canViewMargins: true,
        canViewProfits: true,
        canEditInventory: true,
        canAdjustStock: true,
        canManageInvoices: true,
        canManageCustomers: true,
        canViewExecutiveAnalytics: true,
        canDeleteRecords: false, // Managers cannot permanently delete catalog/customer records
      };

    case "cashier":
      return {
        canViewCosts: false, // MASKED: buy_price is hidden
        canViewMargins: false, // MASKED: margin % is hidden
        canViewProfits: false, // MASKED: profit is hidden
        canEditInventory: false,
        canAdjustStock: false,
        canManageInvoices: true, // Cashiers can bill and create POS invoices
        canManageCustomers: true,
        canViewExecutiveAnalytics: false, // Restricted
        canDeleteRecords: false,
      };

    case "member":
      return {
        canViewCosts: false, // Completely hidden from member
        canViewMargins: false, // Completely hidden from member
        canViewProfits: false, // No profit shown on dashboard
        canEditInventory: false, // In inventory only sales price is visible
        canAdjustStock: true, // Member can adjust stock
        canManageInvoices: true, // Member can do invoice
        canManageCustomers: true, // Member can manage customers
        canViewExecutiveAnalytics: true, // Member has oversimplified operational dashboard
        canDeleteRecords: false, // Cannot delete records
      };

    default:
      return getPermissions("member");
  }
}

/**
 * Data masking helper to sanitize inventory items before returning
 * them to clients with restricted cashier or member role.
 */
export function maskSensitiveItemData<T extends { buy_price?: number }>(
  item: T,
  role: AppRole
): T {
  if (role === "cashier" || role === "member") {
    return {
      ...item,
      buy_price: 0,
    };
  }
  return item;
}

export function maskSensitiveItemList<T extends { buy_price?: number }>(
  items: T[],
  role: AppRole
): T[] {
  if (role === "cashier" || role === "member") {
    return items.map((it) => maskSensitiveItemData(it, role));
  }
  return items;
}
