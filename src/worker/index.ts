import "../config/loadEnv";
import { hostname } from "node:os";
import { createPgPool } from "../db/pgClient";
import { requireEnv } from "../config/env";
import { PostgresJobQueue } from "../queue/postgresQueue";
import { S3Storage } from "../storage/s3Storage";
import { workerLoop } from "./workerLoop";

async function main(): Promise<void> {
  const dbUrl = requireEnv("DATABASE_URL");
  const bucket = requireEnv("YC_STORAGE_BUCKET");
  const endpoint = requireEnv("YC_STORAGE_ENDPOINT");
  const region = requireEnv("YC_STORAGE_REGION");
  const accessKeyId = requireEnv("YC_STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("YC_STORAGE_SECRET_ACCESS_KEY");
  const workerId = process.env.WORKER_ID ?? hostname();

  const pool = createPgPool(dbUrl);
  const queue = new PostgresJobQueue(pool);
  const storage = new S3Storage({
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
  });

  const deps = {
    storage,
    bucket,
    storageEndpoint: endpoint,
    db: pool,
    rawPath: (orgId: string, callId: string, fileName: string) =>
      `orgs/${orgId}/calls/${callId}/raw/${fileName}`,
    audioPath: (orgId: string, callId: string) =>
      `orgs/${orgId}/calls/${callId}/artifacts/audio/${callId}.mp3`,
    transcriptPath: (orgId: string, callId: string) =>
      `orgs/${orgId}/calls/${callId}/artifacts/transcript/${callId}.json`,
    transcriptAudioPath: (orgId: string, callId: string) =>
      `orgs/${orgId}/calls/${callId}/artifacts/transcript/${callId}.ogg`,
    analysisPath: (orgId: string, callId: string, analysisId?: string) =>
      `orgs/${orgId}/calls/${callId}/artifacts/analysis/${analysisId ?? callId}.json`,
    enqueueJobAt: queue.enqueueAt?.bind(queue),
    enqueueJob: queue.enqueue.bind(queue),
    onAudioArtifact: async (input: {
      orgId: string;
      callId: string;
      storagePath: string;
      contentType: string;
      sizeBytes?: number;
    }) => {
      await pool.query(
        `insert into artifacts (org_id, call_id, kind, storage_path, content_type, size_bytes)
         values ($1, $2, 'audio', $3, $4, $5)
         on conflict do nothing`,
        [
          input.orgId,
          input.callId,
          input.storagePath,
          input.contentType,
          input.sizeBytes ?? null,
        ],
      );
    },
    onTranscriptArtifact: async (input: {
      orgId: string;
      callId: string;
      storagePath: string;
      contentType: string;
      sizeBytes?: number;
    }) => {
      await pool.query(
        `insert into artifacts (org_id, call_id, kind, storage_path, content_type, size_bytes)
         values ($1, $2, 'transcript', $3, $4, $5)
         on conflict do nothing`,
        [
          input.orgId,
          input.callId,
          input.storagePath,
          input.contentType,
          input.sizeBytes ?? null,
        ],
      );
    },
    onAnalysisArtifact: async (input: {
      orgId: string;
      callId: string;
      storagePath: string;
      contentType: string;
      sizeBytes?: number;
    }) => {
      await pool.query(
        `insert into artifacts (org_id, call_id, kind, storage_path, content_type, size_bytes)
         values ($1, $2, 'analysis', $3, $4, $5)
         on conflict do nothing`,
        [
          input.orgId,
          input.callId,
          input.storagePath,
          input.contentType,
          input.sizeBytes ?? null,
        ],
      );
    },
  };

  await workerLoop(queue, deps, workerId);
}

main().catch((error) => {
  console.error("worker failed to start", error);
  process.exit(1);
});
