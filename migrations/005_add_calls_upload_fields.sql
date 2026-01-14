alter table calls
  add column if not exists upload_status text not null default 'pending',
  add column if not exists upload_progress int not null default 0,
  add column if not exists upload_size_bytes bigint,
  add column if not exists upload_mime text,
  add column if not exists upload_error text,
  add column if not exists upload_updated_at timestamptz not null default now();

create index if not exists calls_upload_status_idx
  on calls (upload_status);

alter table calls
  add constraint calls_upload_progress_range
  check (upload_progress >= 0 and upload_progress <= 100);
