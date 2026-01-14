import { createPgPool } from "../db/pgClient";
import { PostgresJobQueue } from "../queue/postgresQueue";
import { requireEnv } from "../config/env";
import { runStage } from "../worker/runStage";
import { S3Storage } from "../storage/s3Storage";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const callId = requireEnv("CALL_ID");
  const bucket = requireEnv("YC_STORAGE_BUCKET");
  const pollIntervalMs = process.env.POLL_INTERVAL_MS
    ? Number(process.env.POLL_INTERVAL_MS)
    : 10000;
  const timeoutMs = process.env.POLL_TIMEOUT_MS
    ? Number(process.env.POLL_TIMEOUT_MS)
    : 30 * 60 * 1000;

  const pool = createPgPool(requireEnv("DATABASE_URL"));
  const queue = new PostgresJobQueue(pool);
  const storage = new S3Storage({
    endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
    region: requireEnv("YC_STORAGE_REGION"),
    accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
  });

  const deps = {
    storage,
    bucket,
    storageEndpoint: requireEnv("YC_STORAGE_ENDPOINT"),
    rawPath: (o: string, c: string, f: string) => `orgs/${o}/calls/${c}/raw/${f}`,
    audioPath: (o: string, c: string) => `orgs/${o}/calls/${c}/artifacts/audio/${c}.mp3`,
    transcriptPath: (o: string, c: string) =>
      `orgs/${o}/calls/${c}/artifacts/transcript/${c}.json`,
    transcriptAudioPath: (o: string, c: string) =>
      `orgs/${o}/calls/${c}/artifacts/transcript/${c}.ogg`,
    analysisPath: (o: string, c: string) =>
      `orgs/${o}/calls/${c}/artifacts/analysis/${c}.json`,
    enqueueJobAt: queue.enqueueAt?.bind(queue),
    enqueueJob: queue.enqueue.bind(queue),
    onAudioArtifact: async () => {},
    onTranscriptArtifact: async () => {},
  };

  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const job = await pool.query<{
        id: string;
        org_id: string;
        call_id: string;
        stage: "transcribe_poll";
        status: "queued" | "processing" | "done" | "failed";
        payload: Record<string, unknown>;
        attempts: number;
        max_attempts: number;
      }>(
        `select *
         from processing_jobs
         where call_id = $1
           and stage = 'transcribe_poll'
           and status = 'queued'
         order by created_at asc
         limit 1`,
        [callId],
      );

      const row = job.rows[0];
      if (!row) {
        console.log("no queued transcribe_poll job yet, waiting...");
        await sleep(pollIntervalMs);
        continue;
      }

      console.log("polling job", {
        id: row.id,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      });

      await runStage(
        {
          id: row.id,
          orgId: row.org_id,
          callId: row.call_id,
          stage: row.stage,
          status: row.status,
          payload: row.payload ?? {},
          attempts: row.attempts,
          maxAttempts: row.max_attempts,
        },
        deps,
      );

      const jobStatus = await pool.query<{
        status: string;
        last_error: string | null;
        attempts: number;
        max_attempts: number;
      }>(
        `select status, last_error, attempts, max_attempts
         from processing_jobs
         where id = $1`,
        [row.id],
      );

      const statusRow = jobStatus.rows[0];
      if (statusRow?.last_error) {
        console.log("polling job error", {
          status: statusRow.status,
          attempts: statusRow.attempts,
          maxAttempts: statusRow.max_attempts,
          lastError: statusRow.last_error,
        });
      }

      const artifacts = await pool.query(
        `select kind, storage_path from artifacts where call_id = $1 order by kind`,
        [callId],
      );
      const hasTranscript = artifacts.rows.some((row) => row.kind === "transcript");
      if (hasTranscript) {
        await pool.query(
          `update processing_jobs set status = 'done', updated_at = now() where id = $1`,
          [row.id],
        );
        await pool.query(
          `update calls
           set status = 'transcribed',
               upload_updated_at = now()
           where id = $1`,
          [callId],
        );
        console.log("transcription completed", { callId, artifacts: artifacts.rows });
        return;
      }

      console.log("transcription still running, waiting...");
      await sleep(pollIntervalMs);
    }

    throw new Error("polling timed out");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("polling failed", error);
  process.exit(1);
});
