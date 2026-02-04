# one-to-one-staging

MVP backend for call/presentation processing: API endpoints for uploads + a worker that extracts audio and runs SpeechKit transcription. Storage is S3-compatible (Yandex Cloud), and jobs are queued in Postgres.

## Repo layout
- `src/app/api/*` Next.js API routes for uploads/calls.
- `src/worker/*` Worker loop + processing stages.
- `src/queue/*` Postgres-backed queue implementation.
- `migrations/` SQL migrations.
- `protos/` SpeechKit gRPC protos.

## Setup
1) Install deps: `npm install`
2) Configure env vars (see `.env.example`). Use a local `.env` or `.env.local` file; do not commit secrets.

## Running
1) Start Next.js dev server: `npm run dev`
2) Run migrations (requires `psql` and `DATABASE_URL`): `npm run migrate`
3) Start worker: `npm run worker`

## Running (examples)
- Generate upload URL: `npx tsx src/scripts/generateUploadUrl.ts`
- Enqueue a test job: `npx tsx src/scripts/enqueueTestJob.ts`
- Poll transcription: `npx tsx src/scripts/pollTranscription.ts`
- Smoke test pipeline: `npm run smoke`

## Docs
- Architecture: `ARCHITECTURE.md`
- Queue design: `QUEUE_POSTGRES.md`
- Decision log: `DECISIONS.md`
- Requirements notes: `HIGH-LEVEL-REQUIREMENTS.MD`
