# Postgres Jobs Queue (Phase 1)

This document defines the Phase 1 job queue using a Postgres table and polling workers. It is designed to be easy to replace with Redis/BullMQ later.

## Goals
- Durable, minimal infra (no Redis).
- Safe concurrency with row-level locking.
- Clear retry/backoff behavior.
- Compatible job payloads with future BullMQ jobs.

## Table Schema (SQL)
```sql
create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  call_id uuid not null,
  stage text not null, -- extract_audio | transcribe_start | transcribe_poll | analyze
  status text not null, -- queued | processing | done | failed
  payload jsonb not null default '{}'::jsonb,
  attempts int not null default 0,
  max_attempts int not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists processing_jobs_ready_idx
  on processing_jobs (status, available_at);

create index if not exists processing_jobs_call_idx
  on processing_jobs (call_id);

create index if not exists processing_jobs_org_idx
  on processing_jobs (org_id);
```

RLS should scope by `org_id`.

## Core SQL Operations

### Enqueue
```sql
insert into processing_jobs (org_id, call_id, stage, status, payload)
values ($1, $2, $3, 'queued', $4);
```

### Claim (single job)
```sql
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
```

### Complete
```sql
update processing_jobs
set status = 'done',
    updated_at = now()
where id = $1;
```

### Fail (with retry)
```sql
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
```

Backoff interval example: `($3)` as `make_interval(secs => 30 * pow(2, attempts))` in code.

## Worker Loop (Node/TS pseudocode)
```ts
interface QueueJob {
  id: string;
  org_id: string;
  call_id: string;
  stage: "extract_audio" | "transcribe_start" | "transcribe_poll" | "analyze";
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

interface JobQueue {
  enqueue(job: Omit<QueueJob, "id" | "attempts">): Promise<void>;
  claim(workerId: string): Promise<QueueJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string, backoffSeconds: number): Promise<void>;
}

async function workerLoop(queue: JobQueue, workerId: string) {
  while (true) {
    const job = await queue.claim(workerId);
    if (!job) {
      await sleep(1000);
      continue;
    }
    try {
      await runStage(job); // extract_audio | transcribe_start | transcribe_poll | analyze
      await queue.complete(job.id);
    } catch (err) {
      const backoff = Math.min(600, 30 * Math.pow(2, job.attempts));
      await queue.fail(job.id, String(err), backoff);
    }
  }
}
```

## Transcription Flow (SpeechKit async)
The transcription stage is split into two jobs:
- `transcribe_start`: downloads the audio artifact, converts it to OGG Opus, uploads it, and starts SpeechKit. It enqueues a `transcribe_poll` job with `operationId` and artifact paths.
- `transcribe_poll`: checks the async operation. If not ready, it re-enqueues itself with a delay (`available_at`) until completion or max attempts.

This avoids holding a worker while waiting for the external API and keeps retries explicit.

## Retry Behavior
- **Claim retry/backoff:** failed jobs are re-queued with exponential backoff via `available_at`.
- **Transcription polling:** `transcribe_poll` uses scheduled re-enqueue with a fixed interval (e.g., `SPEECHKIT_POLL_INTERVAL_MS`) and a higher `max_attempts` to allow long-running operations.
- **Poison jobs:** when `attempts + 1 >= max_attempts`, the job is marked `failed` and no longer scheduled.

## Idempotency (Current Behavior)
- Stages write to deterministic storage paths and insert artifact rows with `on conflict do nothing`.
- `extract_audio` and `transcribe_*` check for existing artifacts in storage and return early if already present.
- `analyze` idempotency is pending implementation.
- If an artifact already exists, the stage also removes temporary/obsolete inputs (e.g., raw upload or OGG transcript audio) to reduce storage bloat.

## Migration to Redis/BullMQ
Keep the handler interface (`runStage`, job payload schema, stage names) stable. Only swap the `JobQueue` implementation.
