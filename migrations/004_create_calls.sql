create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  created_by uuid,
  status text not null default 'queued',
  source_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calls_org_idx
  on calls (org_id);

create index if not exists calls_status_idx
  on calls (status);

alter table calls enable row level security;

create policy calls_org_isolation
  on calls
  for select
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy calls_org_insert
  on calls
  for insert
  with check (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy calls_org_update
  on calls
  for update
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy calls_org_delete
  on calls
  for delete
  using (org_id = (select org_id from profiles where user_id = auth.uid()));
