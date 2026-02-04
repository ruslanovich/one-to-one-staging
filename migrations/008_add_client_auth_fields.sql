alter table clients
  add column if not exists auth_user_id uuid,
  add column if not exists auth_invited_at timestamptz;

create unique index if not exists clients_auth_user_unique
  on clients (auth_user_id);
