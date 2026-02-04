create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  inn text,
  website_url text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_email_unique
  on clients (email);

create index if not exists clients_created_at_idx
  on clients (created_at);

create table if not exists org_prompts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references clients (id) on delete cascade,
  customization_prompt text not null,
  analysis_prompt text not null,
  website_url text,
  llm_output jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists org_prompts_org_unique
  on org_prompts (org_id);

create index if not exists org_prompts_created_at_idx
  on org_prompts (created_at);

alter table clients enable row level security;

create policy clients_org_isolation
  on clients
  for select
  using (id = (select org_id from profiles where user_id = auth.uid()));

create policy clients_org_insert
  on clients
  for insert
  with check (id = (select org_id from profiles where user_id = auth.uid()));

create policy clients_org_update
  on clients
  for update
  using (id = (select org_id from profiles where user_id = auth.uid()));

create policy clients_org_delete
  on clients
  for delete
  using (id = (select org_id from profiles where user_id = auth.uid()));

alter table org_prompts enable row level security;

create policy org_prompts_org_isolation
  on org_prompts
  for select
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy org_prompts_org_insert
  on org_prompts
  for insert
  with check (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy org_prompts_org_update
  on org_prompts
  for update
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

create policy org_prompts_org_delete
  on org_prompts
  for delete
  using (org_id = (select org_id from profiles where user_id = auth.uid()));
