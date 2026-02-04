create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  content text not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prompt_templates_key_unique
  on prompt_templates (prompt_key);

create index if not exists prompt_templates_created_at_idx
  on prompt_templates (created_at);

insert into prompt_templates (prompt_key, content, description)
values (
  'customization',
  'MOCK: write a customized analysis prompt for sales call transcripts using the provided website URL.',
  'Customization prompt template used during client registration.'
)
on conflict (prompt_key) do nothing;

alter table prompt_templates enable row level security;

create policy prompt_templates_admin_read
  on prompt_templates
  for select
  using (
    exists (
      select 1
      from profiles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy prompt_templates_admin_write
  on prompt_templates
  for insert
  with check (
    exists (
      select 1
      from profiles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy prompt_templates_admin_update
  on prompt_templates
  for update
  using (
    exists (
      select 1
      from profiles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );

create policy prompt_templates_admin_delete
  on prompt_templates
  for delete
  using (
    exists (
      select 1
      from profiles
      where user_id = auth.uid()
        and role = 'admin'
    )
  );
