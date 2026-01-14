create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  call_id uuid not null,
  kind text not null, -- audio | transcript | analysis
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  checksum text,
  created_at timestamptz not null default now()
);

create index if not exists artifacts_call_idx
  on artifacts (call_id);

create index if not exists artifacts_org_idx
  on artifacts (org_id);

create unique index if not exists artifacts_call_kind_unique
  on artifacts (call_id, kind);

-- Enable RLS and add a policy once org_id access rules are finalized.
-- alter table artifacts enable row level security;
-- create policy artifacts_org_isolation
--   on artifacts
--   using (org_id = (auth.jwt() ->> 'org_id')::uuid);
