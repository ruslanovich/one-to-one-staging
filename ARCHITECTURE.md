# MVP Architecture (Simple + Reliable)

This document proposes a minimal but durable architecture for the MVP call/presentation analytics app. It is designed to handle dozens of clients with hundreds of presentations per month, including bursts of parallel uploads.

## Goals
- Simple and fast to build.
- Reliable processing with retries and clear job status.
- Horizontal scaling of workers for bursty uploads.
- Easy migration away from Supabase later.

## Recommended Stack (MVP)
- **API/Web:** Node.js + TypeScript (single codebase, shared types)
- **Workers:** Node.js + TypeScript
- **Queue (Phase 1):** Postgres-backed jobs table + polling worker
- **Queue (Phase 2 / pre-prod):** Redis + BullMQ
- **DB/Auth/Storage:** Supabase (Postgres + Auth + Storage)
- **Media tools:** ffmpeg in worker containers
- **Transcription:** Yandex SpeechKit v3 (gRPC, async)
- **LLM analysis:** OpenAI Agents SDK

Python is viable, but using Node/TS for both web and workers keeps the stack simpler and avoids cross-language DTO drift.

## High-Level Diagram (Logical) — Phase 1 (Postgres jobs)

```
Browser
  |
  v
Web/API (Node/TS)
  |  (create call record, upload metadata)
  v
Supabase DB + Storage
  |  (job enqueue into jobs table)
  v
Workers (Node/TS + ffmpeg)
  |  -> extract audio
  |  -> transcribe_start/transcribe_poll (SpeechKit)
  |  -> analyze (OpenAI Agents SDK)
  v
Supabase DB + Storage (artifacts + results)
```

## Core Components
1. **Web/API service**
   - Auth (Supabase)
   - Upload orchestration (signed URLs)
   - Job creation + status polling
   - Result presentation

2. **Postgres jobs table (Phase 1)**
   - Durable job storage in DB
   - Workers poll and lock jobs with `FOR UPDATE SKIP LOCKED`

3. **Worker service**
   - Downloads media from Storage
   - Extracts audio (ffmpeg)
   - Deletes original video after audio stored
   - Calls SpeechKit v3 (gRPC, async) + OpenAI Agents SDK
   - Writes results + artifacts to DB/Storage

## Data Flow (Upload → Results)
1. Web/API creates `call` record with status `queued`.
2. Client uploads file directly to Storage using signed URL.
3. Web/API enqueues stage jobs into `processing_jobs`.
4. Worker pulls job and runs stages:
   - `extract_audio`
   - `transcribe_start`
   - `transcribe_poll`
   - `analyze`
5. Each stage persists status + errors in DB.
6. UI polls status and displays results when ready.

## Job Model (Phase 1: Postgres)
Use a single jobs table with explicit stages and status. Workers select jobs with:
`SELECT ... FOR UPDATE SKIP LOCKED` to avoid double processing.

Suggested stages (table `processing_jobs`):
- `extract_audio` (required for video)
- `transcribe_start` + `transcribe_poll` (required for audio/video)
- `analyze` (always from transcript)

Status fields:
- `queued` → `processing` → `done` / `failed`
- `attempts`, `last_error`, `started_at`, `finished_at`

Idempotency:
- Artifacts are written to deterministic storage paths.
- `extract_audio` and `transcribe_*` short-circuit if the artifact already exists in storage.

## Storage Layout (Supabase)
```
orgs/{org_id}/calls/{call_id}/raw/{original_filename}
orgs/{org_id}/calls/{call_id}/artifacts/audio/{call_id}.mp3
orgs/{org_id}/calls/{call_id}/artifacts/transcript/{call_id}.json
orgs/{org_id}/calls/{call_id}/artifacts/analysis/{call_id}.json
```

Retention:
- Delete raw video after audio extraction completes successfully.
- Keep audio, transcript, and analysis.

## Data Model (Minimal)
Tables:
- `orgs`
- `profiles` (user_id, org_id, role)
- `calls` (id, org_id, status, created_by, duration, source, error)
- `processing_jobs` (id, call_id, stage, status, attempts, last_error, started_at, finished_at)
- `artifacts` (id, call_id, kind, storage_path, size, checksum)

All tables are scoped by `org_id` with RLS.

## Reliability & Failure Handling
- **Retries:** app-level retries with exponential backoff.
- **Timeouts:** enforce per-stage timeouts (ffmpeg, SpeechKit v3, OpenAI Agents SDK).
- **Idempotency:** deterministic artifact paths; explicit short-circuit checks are planned.
- **Poison jobs:** after N retries, mark `failed`, show error in UI, allow manual retry.

## Transcription Flow (Current)
- `transcribe_start` converts MP3 to OGG/Opus, uploads it, and starts SpeechKit async transcription.
- It enqueues a `transcribe_poll` job with `operationId` and a delay (`available_at`) to avoid busy waiting.
- `transcribe_poll` re-enqueues itself on “not ready yet” until completion or max attempts; on success it writes the transcript artifact and enqueues `analyze`.

## Scaling Approach
- **Web/API**: mostly I/O; scale horizontally.
- **Workers**: CPU-heavy; scale horizontally based on queue backlog.
- **Concurrency**: start with `2-4` concurrent jobs per worker VM; tune based on CPU and SpeechKit quotas.

## VM Sizing (Yandex Cloud VPS)
Initial suggestion for MVP:
- **API VM**: 2 vCPU / 4 GB RAM
- **Worker VM**: 4-8 vCPU / 8-16 GB RAM (ffmpeg + parallel jobs)
- **Redis**: managed service preferred; if self-hosted, 2 vCPU / 4 GB RAM

If uploads are bursty, add more worker VMs rather than scaling the API.

## Redis Options (Phase 2 / pre-prod)
### Option A: Yandex Managed Service for Redis (Preferred)
Pros: durability, backups, minimal ops.
Actions needed:
1. Create a Managed Redis cluster in Yandex Cloud.
2. Place it in the same VPC as your VMs.
3. Allow connections from worker/API security groups.
4. Set `REDIS_URL` in both API and worker containers.

### Option B: Self-host Redis on VPS
Pros: cheaper, simple to start.
Cons: you manage persistence, backups, and failover.
Actions needed:
- Run Redis in Docker with persistence (`appendonly yes`).
- Add disk backups or snapshots.
- Monitor memory usage and OOM risks.

## Phase 1 → Phase 2 Migration Path
To keep the switch easy:
1. Abstract job enqueueing (`enqueueJob`) and job execution (`runJob`) behind an interface.
2. Keep job payloads and stage names stable across queue systems.
3. Add a small adapter layer so Postgres jobs and BullMQ jobs share the same handler code.
4. Run both systems in parallel for a short window and cut over by queueing new jobs to Redis only.

Phase 1 is acceptable for MVP, but plan the Redis move before production traffic ramps up.

## Observability (Minimum)
- Correlation ID: `call_id` in every log line.
- Logs: job start/finish, external API latency, errors.
- Metrics: queue depth, job duration, fail rate.

## Deployment (Docker)
Minimum services:
- `api` (Node/TS)
- `worker` (Node/TS + ffmpeg)
- `redis` (Phase 2, if self-hosted)

## Phase 1 Queue Details
See `QUEUE_POSTGRES.md` for the Postgres jobs table schema, SQL operations, and a minimal worker loop.

Later: add autoscaling workers and a log aggregator.
