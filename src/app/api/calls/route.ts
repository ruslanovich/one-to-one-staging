import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { PostgresJobQueue } from "@/queue/postgresQueue";
import { enqueueProcessingStages } from "@/api/jobs";
import { requireEnv } from "@/config/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { orgId, createdBy, fileName } = body ?? {};

  if (!orgId || !fileName) {
    return NextResponse.json(
      { error: "orgId and fileName are required" },
      { status: 400 },
    );
  }

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    const result = await pool.query<{
      id: string;
    }>(
      `insert into calls (org_id, created_by, status, source_filename, upload_status, upload_progress)
       values ($1, $2, 'queued', $3, 'pending', 0)
       returning id`,
      [orgId, createdBy ?? null, fileName],
    );

    const callId = result.rows[0]?.id;
    if (!callId) {
      return NextResponse.json({ error: "failed to create call" }, { status: 500 });
    }

    const queue = new PostgresJobQueue(pool);
    await enqueueProcessingStages(queue, { orgId, callId, fileName });

    return NextResponse.json({ callId });
  } finally {
    await pool.end();
  }
}
