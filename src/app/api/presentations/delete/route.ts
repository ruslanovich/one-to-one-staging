import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { getSessionByToken, getTokenFromRequest } from "@/auth/session";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { id?: string } = {};
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    body = {};
  }

  const callId = body.id;
  if (!callId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const session = await getSessionByToken(pool, token);
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    await pool.query("begin");
    await pool.query(
      `delete from call_analyses where call_id = $1 and org_id = $2`,
      [callId, session.orgId],
    );
    await pool.query(
      `delete from artifacts where call_id = $1 and org_id = $2`,
      [callId, session.orgId],
    );
    await pool.query(
      `delete from processing_jobs where call_id = $1 and org_id = $2`,
      [callId, session.orgId],
    );
    const result = await pool.query(
      `delete from calls where id = $1 and org_id = $2`,
      [callId, session.orgId],
    );
    await pool.query("commit");

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await pool.query("rollback");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 },
    );
  } finally {
    await pool.end();
  }
}
