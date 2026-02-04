create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz
);

create unique index if not exists sessions_token_unique
  on sessions (token);

create index if not exists sessions_user_idx
  on sessions (user_id);
