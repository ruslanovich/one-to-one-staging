import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { deleteSession, getSessionCookieName, getTokenFromRequest } from "@/auth/session";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    const token = getTokenFromRequest(req);
    if (token) {
      await deleteSession(pool, token);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getSessionCookieName(), "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    return response;
  } finally {
    await pool.end();
  }
}
