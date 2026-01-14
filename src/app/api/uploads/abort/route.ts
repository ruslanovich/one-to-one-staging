import { NextRequest, NextResponse } from "next/server";
import { createS3Client } from "@/storage/s3SignedUrl";
import { abortMultipartUpload } from "@/storage/s3Multipart";
import { requireEnv } from "@/config/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { uploadId, objectKey } = body ?? {};

  if (!uploadId || !objectKey) {
    return NextResponse.json(
      { error: "uploadId and objectKey are required" },
      { status: 400 },
    );
  }

  const client = createS3Client({
    endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
    region: requireEnv("YC_STORAGE_REGION"),
    accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
  });

  await abortMultipartUpload(client, {
    bucket: requireEnv("YC_STORAGE_BUCKET"),
    key: objectKey,
    uploadId,
  });

  return NextResponse.json({ ok: true });
}
