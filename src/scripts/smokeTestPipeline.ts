import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createPgPool } from "../db/pgClient";
import { PostgresJobQueue } from "../queue/postgresQueue";
import { requireEnv } from "../config/env";
import { S3Storage } from "../storage/s3Storage";
import { runStage } from "../worker/runStage";

async function ensureFfmpeg(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("ffmpeg not found in PATH"));
      }
    });
  });
}

async function createSampleVideo(filePath: string): Promise<void> {
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:duration=2",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=640x360:d=2",
    "-shortest",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    filePath,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${code}`));
      }
    });
  });
}

async function main(): Promise<void> {
  const dbUrl = requireEnv("DATABASE_URL");
  const orgId = process.env.ORG_ID;
  const bucket = requireEnv("YC_STORAGE_BUCKET");
  const callId = process.env.CALL_ID ?? randomUUID();
  const testFilePath = process.env.TEST_FILE_PATH;
  const fileName =
    process.env.FILE_NAME ?? (testFilePath ? testFilePath.split("/").pop() : null) ?? "smoke.mp4";

  await ensureFfmpeg();

  const tempDir = await fs.mkdtemp(join(tmpdir(), "smoke-"));
  const localVideo = testFilePath ?? join(tempDir, fileName);

  try {
    if (!testFilePath) {
      await createSampleVideo(localVideo);
    }

    const storage = new S3Storage({
      endpoint: requireEnv("YC_STORAGE_ENDPOINT"),
      region: requireEnv("YC_STORAGE_REGION"),
      accessKeyId: requireEnv("YC_STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("YC_STORAGE_SECRET_ACCESS_KEY"),
    });

    const pool = createPgPool(dbUrl);
    try {
      const resolvedOrgId =
        orgId ??
        (
          await pool.query<{ org_id: string }>(
            `select org_id from profiles order by created_at asc limit 1`,
          )
        ).rows[0]?.org_id;

      if (!resolvedOrgId) {
        throw new Error("ORG_ID not set and no profiles found to derive org_id");
      }

      const rawObjectKey = `orgs/${resolvedOrgId}/calls/${callId}/raw/${fileName}`;
      await storage.upload(bucket, rawObjectKey, localVideo, "video/mp4");

      await pool.query(
        `insert into calls (id, org_id, status, source_filename)
         values ($1, $2, 'queued', $3)
         on conflict do nothing`,
        [callId, resolvedOrgId, fileName],
      );

      await pool.query(
        `insert into processing_jobs (org_id, call_id, stage, status, payload)
         values ($1, $2, 'extract_audio', 'queued', $3),
                ($1, $2, 'transcribe_start', 'queued', $3)
         on conflict do nothing`,
        [resolvedOrgId, callId, { fileName, allowEmptyTranscript: true }],
      );

      const queue = new PostgresJobQueue(pool);
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
      };

      await runStageByName(pool, callId, "extract_audio", deps);
      await runStageByName(pool, callId, "transcribe_start", deps);

      const artifacts = await pool.query(
        `select kind, storage_path from artifacts where call_id = $1 order by kind`,
        [callId],
      );
      console.log("smoke test started (poll separately)", {
        callId,
        artifacts: artifacts.rows,
      });
    } finally {
      await pool.end();
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runStageByName(
  pool: ReturnType<typeof createPgPool>,
  callId: string,
  stage: "extract_audio" | "transcribe_start" | "transcribe_poll",
  deps: Parameters<typeof runStage>[1],
): Promise<void> {
  const result = await pool.query<{
    id: string;
    org_id: string;
    call_id: string;
    stage: "extract_audio" | "transcribe_start" | "transcribe_poll";
    status: "queued" | "processing" | "done" | "failed";
    payload: Record<string, unknown>;
    attempts: number;
    max_attempts: number;
  }>(
    `select *
     from processing_jobs
     where stage = $1
       and call_id = $2
       and status = 'queued'
     order by created_at asc
     limit 1`,
    [stage, callId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`no queued job found for stage ${stage}`);
  }

  const job = {
    id: row.id,
    orgId: row.org_id,
    callId: row.call_id,
    stage: row.stage,
    status: row.status,
    payload: row.payload ?? {},
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  };

  await runStage(job, deps);
  await pool.query(
    `update processing_jobs set status = 'done', updated_at = now() where id = $1`,
    [row.id],
  );
}

main().catch((error) => {
  console.error("smoke test failed", error);
  process.exit(1);
});
