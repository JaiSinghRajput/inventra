import { auth } from "@clerk/nextjs/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client authenticated with the Clerk user's JWT.
 * When the Clerk JWT template "supabase" is configured, this client passes
 * the user's and tenant's claims (org_id, role, sub) to Supabase PostgreSQL RLS.
 */
export function createClerkSupabaseClient(token?: string | null): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabaseKey = serviceRoleKey || publishableKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be defined."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token && !serviceRoleKey ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export interface TenantContext {
  userId: string;
  orgId: string;
  orgRole?: string | null;
  orgSlug?: string | null;
  supabase: SupabaseClient;
}

export interface OptionalTenantContext {
  userId: string | null;
  orgId: string | null;
  orgRole?: string | null;
  orgSlug?: string | null;
  supabase: SupabaseClient;
}

let hasSupabaseTemplate = true;

/**
 * Extracts the active tenant (orgId) from Clerk's auth() context.
 * Enforces strict authentication and organization selection.
 * Throws an error if the user is unauthenticated or has not selected an active organization.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const { userId, orgId, orgRole, orgSlug, getToken } = await auth();

  if (!userId) {
    throw new Error("UNAUTHORIZED: Authentication is required to access tenant resources.");
  }

  if (!orgId) {
    throw new Error(
      "NO_ACTIVE_ORGANIZATION: Multi-tenant data isolation requires an active organization. Please select or create an organization."
    );
  }

  let token: string | null = null;
  if (hasSupabaseTemplate) {
    try {
      token = await getToken({ template: "supabase" });
    } catch (err: unknown) {
      const clerkError = err as { status?: number; errors?: Array<{ code?: string }> };
      if (clerkError?.status === 404 || clerkError?.errors?.[0]?.code === "resource_not_found") {
        hasSupabaseTemplate = false;
      }
      token = null;
    }
  }

  const supabase = createClerkSupabaseClient(token);

  return {
    userId,
    orgId,
    orgRole: orgRole || null,
    orgSlug: orgSlug || null,
    supabase,
  };
}

/**
 * Non-throwing variant for Server Components/Pages that need to safely
 * inspect the active tenant state and render fallback/switch UI.
 */
export async function getOptionalTenantContext(): Promise<OptionalTenantContext> {
  const { userId, orgId, orgRole, orgSlug, getToken } = await auth();

  let token: string | null = null;
  if (userId && hasSupabaseTemplate) {
    try {
      token = await getToken({ template: "supabase" });
    } catch {
      token = null;
    }
  }

  const supabase = createClerkSupabaseClient(token);

  return {
    userId: userId || null,
    orgId: orgId || null,
    orgRole: orgRole || null,
    orgSlug: orgSlug || null,
    supabase,
  };
}
