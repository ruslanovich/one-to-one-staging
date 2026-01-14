import { NextRequest, NextResponse } from "next/server";
import { generateUploadUrl } from "@/api/uploadUrl";
import { createPgPool } from "@/db/pgClient";
import { PostgresJobQueue } from "@/queue/postgresQueue";
import { enqueueProcessingStages } from "@/api/jobs";
import { requireEnv } from "@/config/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { orgId, callId, fileName, contentType, expiresInSeconds, createdBy } = body ?? {};

  if (!orgId || !callId || !fileName) {
    return NextResponse.json(
      { error: "orgId, callId, and fileName are required" },
      { status: 400 },
    );
  }

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    const insertResult = await pool.query<{
      id: string;
    }>(
      `insert into calls (id, org_id, created_by, status, source_filename, upload_status, upload_progress)
       values ($1, $2, $3, 'queued', $4, 'uploading', 0)
       returning id`,
      [callId, orgId, createdBy ?? null, fileName],
    );

    const createdCallId = insertResult.rows[0]?.id;
    if (!createdCallId) {
      return NextResponse.json({ error: "failed to create call" }, { status: 500 });
    }

    const queue = new PostgresJobQueue(pool);
    await enqueueProcessingStages(queue, { orgId, callId: createdCallId, fileName });

    const result = await generateUploadUrl(
      { orgId, callId: createdCallId, fileName, contentType, expiresInSeconds },
      {
        endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
        region: requireEnv("YC_STORAGE_REGION"),
        accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
        bucket: requireEnv("YC_STORAGE_BUCKET"),
      },
    );

    return NextResponse.json({ ...result, callId: createdCallId });
  } finally {
    await pool.end();
  }
}
