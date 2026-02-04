import { requireEnv } from "../config/env";
import { requireServiceRoleKey } from "./adminAuth";

export function getSupabaseUrl(): string {
  return normalizeSupabaseUrl(requireEnv("SUPABASE_URL"));
}

export function getSupabaseAnonKey(): string {
  return requireEnv("SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return requireServiceRoleKey();
}

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("SUPABASE_URL must be a valid https:// URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("SUPABASE_URL must start with http:// or https://");
  }
  return parsed.toString().replace(/\/$/, "");
}
