import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { requireAdmin } from "@/auth/adminAuth";
import { AuthError } from "@/auth/errors";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/auth/supabase";

type RegisterClientPayload = {
  name?: string;
  email?: string;
  inn?: string;
  website_url?: string;
  create_auth_user?: boolean;
  password?: string;
};

type ClientRow = {
  id: string;
  name: string;
  email: string;
  inn: string | null;
  website_url: string | null;
  auth_user_id: string | null;
  auth_invited_at: string | null;
  created_at: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    try {
      await requireAdmin(req, pool);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const result = await pool.query<ClientRow>(
      `select id, name, email, inn, website_url, auth_user_id, auth_invited_at, created_at
       from clients
       order by created_at desc`,
    );
    return NextResponse.json({ clients: result.rows });
  } finally {
    await pool.end();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    let adminUserId: string | null = null;
    try {
      const admin = await requireAdmin(req, pool);
      adminUserId = admin.userId;
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    let body: RegisterClientPayload;
    try {
      body = (await req.json()) as RegisterClientPayload;
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const inn = body?.inn ? String(body.inn).trim() : null;
  const websiteUrlRaw = body?.website_url ? String(body.website_url).trim() : "";
  const createAuthUser = body?.create_auth_user !== false;
  const password = body?.password ? String(body.password) : "";

  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 },
    );
  }

    if (!/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

  let websiteUrl: string | null = null;
  if (websiteUrlRaw) {
    try {
      const parsedUrl = new URL(websiteUrlRaw);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { error: "website_url must be http or https" },
          { status: 400 },
        );
      }
      websiteUrl = parsedUrl.toString();
    } catch {
      return NextResponse.json({ error: "invalid website_url" }, { status: 400 });
    }
  }

    const clientResult = await pool.query<{ id: string }>(
      `insert into clients (name, email, inn, website_url, created_by)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [name, email, inn, websiteUrl, adminUserId],
    );

    const clientId = clientResult.rows[0]?.id;
    if (!clientId) {
      return NextResponse.json({ error: "failed to create client" }, { status: 500 });
    }

    let authUserId: string | null = null;
    if (createAuthUser) {
      try {
        authUserId = password
          ? await createSupabaseUserWithPassword({ email, name, password })
          : await inviteSupabaseUser({ email, name });
        await pool.query(
          `insert into profiles (user_id, org_id, role)
           values ($1, $2, 'member')
           on conflict (user_id)
           do update set org_id = excluded.org_id`,
          [authUserId, clientId],
        );
        await pool.query(
          `update clients
           set auth_user_id = $1,
               auth_invited_at = now(),
               updated_at = now()
           where id = $2`,
          [authUserId, clientId],
        );
      } catch (error) {
        await pool.query(`delete from clients where id = $1`, [clientId]);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "failed to provision auth user",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ clientId, authUserId });
  } finally {
    await pool.end();
  }
}

async function inviteSupabaseUser(input: {
  email: string;
  name: string;
}): Promise<string> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const redirectTo = process.env.SUPABASE_INVITE_REDIRECT_URL ?? null;

  const response = await fetch(`${supabaseUrl}/auth/v1/invite`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email: input.email,
      data: { name: input.name },
      redirect_to: redirectTo ?? undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`supabase invite failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as { id?: string; user?: { id?: string } };
  const userId = payload.user?.id ?? payload.id;
  if (!userId) {
    throw new Error("supabase invite missing user id");
  }
  return userId;
}

async function createSupabaseUserWithPassword(input: {
  email: string;
  name: string;
  password: string;
}): Promise<string> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`supabase user create failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as { id?: string; user?: { id?: string } };
  const userId = payload.user?.id ?? payload.id;
  if (!userId) {
    throw new Error("supabase create user missing user id");
  }
  return userId;
}
