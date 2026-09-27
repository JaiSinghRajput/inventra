"use client";

import { useAuth } from "@clerk/nextjs";
import { AppRole, RolePermissions, resolveUserRole, getPermissions } from "@/lib/rbac";

export interface ClerkRoleInfo {
  role: AppRole;
  permissions: RolePermissions;
  orgRole: string | null | undefined;
  isLoaded: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
  isMember: boolean;
}

/**
 * Hook to retrieve the current Clerk organization role and associated permissions.
 * Directly backed by Clerk authentication with 0 custom management layer.
 */
export function useClerkRole(): ClerkRoleInfo {
  const { orgRole, isLoaded } = useAuth();
  const role = resolveUserRole(orgRole);
  const permissions = getPermissions(role);

  return {
    role,
    permissions,
    orgRole,
    isLoaded,
    isAdmin: role === "admin",
    isManager: role === "manager",
    isCashier: role === "cashier",
    isMember: role === "member",
  };
}
