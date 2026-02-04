import { NextRequest, NextResponse } from "next/server";
import { createPgPool } from "@/db/pgClient";
import { PostgresJobQueue } from "@/queue/postgresQueue";
import { enqueueProcessingStages } from "@/api/jobs";
import { createS3Client } from "@/storage/s3SignedUrl";
import { completeMultipartUpload, listMultipartUploadParts } from "@/storage/s3Multipart";
import { requireEnv } from "@/config/env";
import { validateUploadInput } from "@/shared/uploadTypes";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const {
    uploadId,
    objectKey,
    parts,
    orgId,
    callId,
    fileName,
    sizeBytes,
    mime,
    sourceFileName,
    uploadKind,
  } = body ?? {};

  if (!uploadId || !objectKey || !orgId || !callId || !fileName) {
    return NextResponse.json(
      { error: "uploadId, objectKey, orgId, callId, fileName are required" },
      { status: 400 },
    );
  }

  const validation = validateUploadInput({
    fileName,
    sourceFileName,
    sourceKind: uploadKind,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: "unsupported upload file type", details: validation.errors },
      { status: 400 },
    );
  }

  const client = createS3Client({
    endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
    region: requireEnv("YC_STORAGE_REGION"),
    accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
  });

  const bucket = requireEnv("YC_STORAGE_BUCKET");
  let resolvedParts: Array<{ partNumber: number; etag: string }> = [];
  if (Array.isArray(parts) && parts.length > 0) {
    resolvedParts = parts.map((part: { partNumber: number; etag: string }) => ({
      partNumber: Number(part.partNumber),
      etag: String(part.etag),
    }));
  } else {
    resolvedParts = await listMultipartUploadParts(client, {
      bucket,
      key: objectKey,
      uploadId,
    });
  }

  if (resolvedParts.length === 0) {
    return NextResponse.json({ error: "no uploaded parts found" }, { status: 400 });
  }

  await completeMultipartUpload(client, {
    bucket,
    key: objectKey,
    uploadId,
    parts: resolvedParts,
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
    await enqueueProcessingStages(queue, {
      orgId,
      callId,
      fileName,
      contentType: mime ?? null,
    });

    return NextResponse.json({ ok: true });
  } finally {
    await pool.end();
  }
}
