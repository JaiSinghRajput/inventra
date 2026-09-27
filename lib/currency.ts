/**
 * Global Indian Rupee (INR / ₹) Currency Formatter for Inventra Enterprise.
 * Unconditionally prepends the official ₹ symbol and applies Indian number grouping (lakhs & crores).
 */

export function formatCurrency(amount: number | string | null | undefined): string {
  const numeric = typeof amount === "string" ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(numeric)) return "₹0.00";

  const formatted = numeric.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `₹${formatted}`;
}

export function formatCompactCurrency(amount: number | string | null | undefined): string {
  const numeric = typeof amount === "string" ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(numeric)) return "₹0";

  const formatted = numeric.toLocaleString("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return `₹${formatted}`;
}
