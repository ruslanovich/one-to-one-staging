import type { Pool } from "pg";
import { requireEnv } from "../config/env";
import { requireSession } from "./session";
import { AuthError } from "./errors";

export type AdminAuthResult = {
  userId: string;
  orgId: string;
};

export async function requireAdmin(request: Request, pool: Pool): Promise<AdminAuthResult> {
  const session = await requireSession(request, pool);
  if (session.role !== "admin") {
    throw new AuthError("forbidden", 403);
  }

  return { userId: session.userId, orgId: session.orgId };
}

export function requireServiceRoleKey(): string {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.service_role_key;
  if (!serviceRoleKey) {
    throw new Error("missing env var: SUPABASE_SERVICE_ROLE_KEY");
  }
  return serviceRoleKey;
}
