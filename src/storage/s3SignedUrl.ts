import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3SignedUrlConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SignedUploadInput {
  bucket: string;
  key: string;
  contentType?: string;
  expiresInSeconds?: number;
}

export function createS3Client(config: S3SignedUrlConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export async function createSignedUploadUrl(
  client: S3Client,
  input: SignedUploadInput,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 900,
  });
}
