import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { requireEnv } from "@/config/env";
import { getSessionByToken, getTokenFromRequest } from "@/auth/session";

export async function GET(req: NextRequest): Promise<NextResponse> {
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

    const result = await pool.query<{
      id: string;
      source_filename: string | null;
      created_at: Date;
      status: string;
      upload_status: string;
      upload_progress: number;
      analysis_id: string | null;
      analysis_created_at: Date | null;
      headline_text: string | null;
      summary_text: string | null;
      bant_total_score: number | null;
      bant_total_max: number | null;
      bant_verdict: string | null;
    }>(
      `select c.id,
              c.source_filename,
              c.created_at,
              c.status,
              c.upload_status,
              c.upload_progress,
              a.id as analysis_id,
              a.created_at as analysis_created_at,
              a.headline_text,
              a.summary_text,
              a.bant_total_score,
              a.bant_total_max,
              a.bant_verdict
       from calls c
       left join lateral (
         select * from call_analyses ca
         where ca.call_id = c.id
         order by ca.created_at desc
         limit 1
       ) a on true
       where c.org_id = $1
       order by c.created_at desc`,
      [session.orgId],
    );

    return NextResponse.json({ items: result.rows });
  } finally {
    await pool.end();
  }
}
