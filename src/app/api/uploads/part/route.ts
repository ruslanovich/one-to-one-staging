import { NextRequest, NextResponse } from "next/server";
import { createS3Client } from "@/storage/s3SignedUrl";
import { createUploadPartUrl } from "@/storage/s3Multipart";
import { requireEnv } from "@/config/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const { uploadId, objectKey, partNumber, expiresInSeconds } = body ?? {};

  if (!uploadId || !objectKey || !partNumber) {
    return NextResponse.json(
      { error: "uploadId, objectKey, and partNumber are required" },
      { status: 400 },
    );
  }

  const client = createS3Client({
    endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
    region: requireEnv("YC_STORAGE_REGION"),
    accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
  });

  const url = await createUploadPartUrl(client, {
    bucket: requireEnv("YC_STORAGE_BUCKET"),
    key: objectKey,
    uploadId,
    partNumber: Number(partNumber),
    expiresIn: expiresInSeconds ? Number(expiresInSeconds) : undefined,
  });

  return NextResponse.json({ uploadUrl: url });
}
