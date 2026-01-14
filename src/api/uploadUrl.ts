import { createS3Client, createSignedUploadUrl } from "../storage/s3SignedUrl";

export interface UploadUrlInput {
  orgId: string;
  callId: string;
  fileName: string;
  contentType?: string;
  expiresInSeconds?: number;
}

export interface UploadUrlResult {
  objectKey: string;
  uploadUrl: string;
}

export function buildRawObjectKey(orgId: string, callId: string, fileName: string): string {
  return `orgs/${orgId}/calls/${callId}/raw/${fileName}`;
}

export async function generateUploadUrl(
  input: UploadUrlInput,
  config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  },
): Promise<UploadUrlResult> {
  const client = createS3Client(config);
  const objectKey = buildRawObjectKey(input.orgId, input.callId, input.fileName);
  const uploadUrl = await createSignedUploadUrl(client, {
    bucket: config.bucket,
    key: objectKey,
    contentType: input.contentType,
    expiresInSeconds: input.expiresInSeconds,
  });

  return { objectKey, uploadUrl };
}
