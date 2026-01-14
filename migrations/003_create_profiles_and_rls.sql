create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy profiles_read_own
  on profiles
  for select
  using (user_id = auth.uid());

create policy profiles_insert_own
  on profiles
  for insert
  with check (user_id = auth.uid());

create policy profiles_update_own
  on profiles
  for update
  using (user_id = auth.uid());

alter table processing_jobs enable row level security;

create policy processing_jobs_org_isolation
  on processing_jobs
  for select
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy processing_jobs_org_insert
  on processing_jobs
  for insert
  with check (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy processing_jobs_org_update
  on processing_jobs
  for update
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy processing_jobs_org_delete
  on processing_jobs
  for delete
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

alter table artifacts enable row level security;

create policy artifacts_org_isolation
  on artifacts
  for select
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy artifacts_org_insert
  on artifacts
  for insert
  with check (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy artifacts_org_update
  on artifacts
  for update
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy artifacts_org_delete
  on artifacts
  for delete
  using (org_id = (select org_id from profiles where user_id = auth.uid()));
