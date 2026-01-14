import { randomUUID } from "node:crypto";
import { generateUploadUrl } from "../api/uploadUrl";
import { requireEnv } from "../config/env";

async function main(): Promise<void> {
  const orgId = requireEnv("ORG_ID");
  const fileName = requireEnv("FILE_NAME");
  const callId = process.env.CALL_ID ?? randomUUID();
  const contentType = process.env.CONTENT_TYPE;
  const expiresInSeconds = process.env.EXPIRES_IN_SECONDS
    ? Number(process.env.EXPIRES_IN_SECONDS)
    : undefined;

  const result = await generateUploadUrl(
    { orgId, callId, fileName, contentType, expiresInSeconds },
    {
      endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
      region: requireEnv("YC_STORAGE_REGION"),
      accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
      bucket: requireEnv("YC_STORAGE_BUCKET"),
    },
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("generate upload url failed", error);
  process.exit(1);
});
