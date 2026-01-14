import { randomUUID } from "node:crypto";
import { createPgPool } from "../db/pgClient";
import { PostgresJobQueue } from "../queue/postgresQueue";
import { enqueueProcessingStages } from "../api/jobs";
import { requireEnv } from "../config/env";

async function main(): Promise<void> {
  const dbUrl = requireEnv("DATABASE_URL");
  const orgId = requireEnv("ORG_ID");
  const fileName = requireEnv("FILE_NAME");
  const callId = process.env.CALL_ID ?? randomUUID();

  const pool = createPgPool(dbUrl);
  const queue = new PostgresJobQueue(pool);

  await enqueueProcessingStages(queue, { orgId, callId, fileName });
  console.log("enqueued call", callId);
  await pool.end();
}

main().catch((error) => {
  console.error("enqueue failed", error);
  process.exit(1);
});
