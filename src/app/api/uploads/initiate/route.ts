import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { createS3Client } from "@/storage/s3SignedUrl";
import { createMultipartUpload } from "@/storage/s3Multipart";
import { buildRawObjectKey } from "@/api/uploadUrl";
import { requireEnv } from "@/config/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { orgId, callId, fileName, contentType, createdBy } = body ?? {};

  if (!orgId || !callId || !fileName) {
    return NextResponse.json(
      { error: "orgId, callId, and fileName are required" },
      { status: 400 },
    );
  }

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  try {
    await pool.query(
      `insert into calls (id, org_id, created_by, status, source_filename, upload_status, upload_progress, upload_mime)
       values ($1, $2, $3, 'queued', $4, 'uploading', 0, $5)
       on conflict (id) do update
         set upload_status = 'uploading',
             upload_progress = 0,
             upload_mime = excluded.upload_mime,
             upload_updated_at = now()`,
      [callId, orgId, createdBy ?? null, fileName, contentType ?? null],
    );

    const client = createS3Client({
      endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
      region: requireEnv("YC_STORAGE_REGION"),
      accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
    });

    const objectKey = buildRawObjectKey(orgId, callId, fileName);
    const { uploadId } = await createMultipartUpload(client, {
      bucket: requireEnv("YC_STORAGE_BUCKET"),
      key: objectKey,
      contentType,
    });

    return NextResponse.json({ uploadId, objectKey });
  } finally {
    await pool.end();
  }
}
