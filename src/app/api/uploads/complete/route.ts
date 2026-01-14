import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { PostgresJobQueue } from "@/queue/postgresQueue";
import { enqueueProcessingStages } from "@/api/jobs";
import { createS3Client } from "@/storage/s3SignedUrl";
import { completeMultipartUpload } from "@/storage/s3Multipart";
import { requireEnv } from "@/config/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { uploadId, objectKey, parts, orgId, callId, fileName, sizeBytes, mime } = body ?? {};

  if (!uploadId || !objectKey || !Array.isArray(parts) || !orgId || !callId || !fileName) {
    return NextResponse.json(
      { error: "uploadId, objectKey, parts, orgId, callId, fileName are required" },
      { status: 400 },
    );
  }

  const client = createS3Client({
    endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
    region: requireEnv("YC_STORAGE_REGION"),
    accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
  });

  await completeMultipartUpload(client, {
    bucket: requireEnv("YC_STORAGE_BUCKET"),
    key: objectKey,
    uploadId,
    parts: parts.map((part: { partNumber: number; etag: string }) => ({
      partNumber: Number(part.partNumber),
      etag: String(part.etag),
    })),
  });

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    await pool.query(
      `update calls
       set upload_status = 'uploaded',
           upload_progress = 100,
           upload_size_bytes = $1,
           upload_mime = $2,
           upload_updated_at = now()
       where id = $3 and org_id = $4`,
      [sizeBytes ?? null, mime ?? null, callId, orgId],
    );

    const queue = new PostgresJobQueue(pool);
    await enqueueProcessingStages(queue, { orgId, callId, fileName });

    return NextResponse.json({ ok: true });
  } finally {
    await pool.end();
  }
}
