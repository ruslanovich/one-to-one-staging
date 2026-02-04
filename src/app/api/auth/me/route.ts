import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { getSessionByToken, getTokenFromRequest } from "@/auth/session";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await getSessionByToken(pool, token);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let email: string | null = null;
    try {
      const emailResult = await pool.query<{ email: string }>(
        `select email from auth.users where id = $1`,
        [session.userId],
      );
      email = emailResult.rows[0]?.email ?? null;
    } catch {
      email = null;
    }

    return NextResponse.json({
      authenticated: true,
      userId: session.userId,
      orgId: session.orgId,
      role: session.role,
      email,
    });
  } finally {
    await pool.end();
  }
}
