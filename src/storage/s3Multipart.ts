import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function createMultipartUpload(
  client: S3Client,
  input: { bucket: string; key: string; contentType?: string },
): Promise<{ uploadId: string }> {
  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: input.bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
  );

  if (!result.UploadId) {
    throw new Error("failed to create multipart upload");
  }

  return { uploadId: result.UploadId };
}

export async function createUploadPartUrl(
  client: S3Client,
  input: { bucket: string; key: string; uploadId: string; partNumber: number; expiresIn?: number },
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: input.bucket,
    Key: input.key,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  });

  return getSignedUrl(client, command, { expiresIn: input.expiresIn ?? 900 });
}

export async function completeMultipartUpload(
  client: S3Client,
  input: {
    bucket: string;
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  },
): Promise<void> {
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: input.bucket,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: input.parts.map((part) => ({
          ETag: part.etag,
          PartNumber: part.partNumber,
        })),
      },
    }),
  );
}

export async function listMultipartUploadParts(
  client: S3Client,
  input: { bucket: string; key: string; uploadId: string },
): Promise<Array<{ partNumber: number; etag: string }>> {
  const result = await client.send(
    new ListPartsCommand({
      Bucket: input.bucket,
      Key: input.key,
      UploadId: input.uploadId,
    }),
  );

  const parts = result.Parts ?? [];
  return parts
    .map((part) => ({
      partNumber: part.PartNumber ?? 0,
      etag: part.ETag ?? "",
    }))
    .filter((part) => part.partNumber > 0 && part.etag.length > 0);
}

export async function abortMultipartUpload(
  client: S3Client,
  input: { bucket: string; key: string; uploadId: string },
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: input.bucket,
      Key: input.key,
      UploadId: input.uploadId,
    }),
  );
}
