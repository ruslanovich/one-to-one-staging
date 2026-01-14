import { JobQueue, QueueJob } from "./types";

export interface DbClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

const CLAIM_SQL = `
with next_job as (
  select id
  from processing_jobs
  where status = 'queued'
    and available_at <= now()
  order by available_at asc
  for update skip locked
  limit 1
)
update processing_jobs
set status = 'processing',
    locked_at = now(),
    locked_by = $1,
    updated_at = now()
where id in (select id from next_job)
returning *;
`;

const ENQUEUE_SQL = `
insert into processing_jobs (org_id, call_id, stage, status, payload, max_attempts)
values ($1, $2, $3, 'queued', $4, $5);
`;

const ENQUEUE_AT_SQL = `
insert into processing_jobs (org_id, call_id, stage, status, payload, max_attempts, available_at)
values ($1, $2, $3, 'queued', $4, $5, $6);
`;

const COMPLETE_SQL = `
update processing_jobs
set status = 'done',
    updated_at = now()
where id = $1;
`;

const FAIL_SQL = `
update processing_jobs
set status = case
    when attempts + 1 >= max_attempts then 'failed'
    else 'queued'
  end,
  attempts = attempts + 1,
  last_error = $2,
  available_at = case
    when attempts + 1 >= max_attempts then available_at
    else now() + ($3::interval)
  end,
  updated_at = now()
where id = $1;
`;

type DbJobRow = {
  id: string;
  org_id: string;
  call_id: string;
  stage: QueueJob["stage"];
  status: QueueJob["status"];
  payload: QueueJob["payload"];
  attempts: number;
  max_attempts: number;
};

export class PostgresJobQueue implements JobQueue {
  private db: DbClient;

  constructor(db: DbClient) {
    this.db = db;
  }

  async enqueue(job: Omit<QueueJob, "id" | "status" | "attempts">): Promise<void> {
    const maxAttempts = job.maxAttempts ?? 5;
    await this.db.query(ENQUEUE_SQL, [
      job.orgId,
      job.callId,
      job.stage,
      job.payload ?? {},
      maxAttempts,
    ]);
  }

  async enqueueAt(
    job: Omit<QueueJob, "id" | "status" | "attempts">,
    availableAt: Date,
  ): Promise<void> {
    const maxAttempts = job.maxAttempts ?? 5;
    await this.db.query(ENQUEUE_AT_SQL, [
      job.orgId,
      job.callId,
      job.stage,
      job.payload ?? {},
      maxAttempts,
      availableAt,
    ]);
  }

  async claim(workerId: string): Promise<QueueJob | null> {
    const result = await this.db.query<DbJobRow>(CLAIM_SQL, [workerId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRow(result.rows[0]);
  }

  async complete(jobId: string): Promise<void> {
    await this.db.query(COMPLETE_SQL, [jobId]);
  }

  async fail(jobId: string, error: string, backoffSeconds: number): Promise<void> {
    const backoffInterval = `${Math.max(0, Math.floor(backoffSeconds))} seconds`;
    const safeError = error.slice(0, 2000);
    await this.db.query(FAIL_SQL, [jobId, safeError, backoffInterval]);
  }

  private mapRow(row: DbJobRow): QueueJob {
    return {
      id: row.id,
      orgId: row.org_id,
      callId: row.call_id,
      stage: row.stage,
      status: row.status,
      payload: row.payload ?? {},
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    };
  }
}
