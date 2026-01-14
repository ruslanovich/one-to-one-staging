create extension if not exists pgcrypto;

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  call_id uuid not null,
  stage text not null,
  status text not null,
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

-- Enable RLS and add a policy once org_id access rules are finalized.
-- alter table processing_jobs enable row level security;
-- create policy processing_jobs_org_isolation
--   on processing_jobs
--   using (org_id = (auth.jwt() ->> 'org_id')::uuid);
