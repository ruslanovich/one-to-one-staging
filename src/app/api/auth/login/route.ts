import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { createSession, getSessionCookieName } from "@/auth/session";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/auth/supabase";

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    let body: LoginPayload;
    try {
      body = (await req.json()) as LoginPayload;
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }

    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 },
      );
    }

    let user: { id: string } | null = null;
    try {
      user = await signInWithSupabase({ email, password });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "failed to contact auth provider",
        },
        { status: 500 },
      );
    }
    if (!user?.id) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
    }

    const profile = await pool.query<{ role: string; org_id: string }>(
      `select role, org_id from profiles where user_id = $1`,
      [user.id],
    );
    const row = profile.rows[0];
    if (!row) {
      return NextResponse.json({ error: "profile not found" }, { status: 403 });
    }

    const { token, expiresAt } = await createSession(pool, user.id);
    const response = NextResponse.json({ role: row.role, orgId: row.org_id });
    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  } finally {
    await pool.end();
  }
}

async function signInWithSupabase(input: {
  email: string;
  password: string;
}): Promise<{ id: string } | null> {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { user?: { id?: string } };
  if (!payload.user?.id) {
    return null;
  }
  return { id: payload.user.id };
}
