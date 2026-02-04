-- Analysis results (structured, multiple per call)

drop index if exists artifacts_call_kind_unique;
create unique index if not exists artifacts_call_kind_path_unique
  on artifacts (call_id, kind, storage_path);

create table if not exists call_analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  call_id uuid not null,
  analysis_storage_path text not null,
  transcript_filename text not null,
  sales_rep_name text not null,
  language text not null,
  source text,
  headline_text text not null,
  summary_text text not null,
  bant_total_score int not null,
  bant_total_max int not null,
  bant_verdict text not null,
  created_at timestamptz not null default now(),
  constraint call_analyses_language_check check (language = 'ru'),
  constraint call_analyses_source_check check (
    source is null or source in ('zoom', 'telemost', 'meet', 'phone', 'other')
  ),
  constraint call_analyses_bant_score_check check (bant_total_score between 4 and 20),
  constraint call_analyses_bant_max_check check (bant_total_max = 20)
);

create unique index if not exists call_analyses_storage_path_unique
  on call_analyses (analysis_storage_path);

create index if not exists call_analyses_call_idx
  on call_analyses (call_id, created_at desc);

create index if not exists call_analyses_org_idx
  on call_analyses (org_id);

create index if not exists call_analyses_bant_score_idx
  on call_analyses (bant_total_score);

create table if not exists call_analysis_bant_criteria (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references call_analyses (id) on delete cascade,
  code text not null,
  label text not null,
  score int not null,
  max_score int not null,
  constraint call_analysis_bant_code_check check (code in ('B', 'A', 'N', 'T')),
  constraint call_analysis_bant_label_check check (
    label in ('Budget', 'Authority', 'Need', 'Timing')
  ),
  constraint call_analysis_bant_score_check check (score between 1 and 5),
  constraint call_analysis_bant_max_score_check check (max_score = 5)
);

create unique index if not exists call_analysis_bant_criteria_unique
  on call_analysis_bant_criteria (analysis_id, code);

create index if not exists call_analysis_bant_criteria_analysis_idx
  on call_analysis_bant_criteria (analysis_id);

create table if not exists call_analysis_bant_bullets (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references call_analysis_bant_criteria (id) on delete cascade,
  type text not null,
  text text not null,
  constraint call_analysis_bant_bullet_type_check check (type in ('positive', 'risk'))
);

create index if not exists call_analysis_bant_bullets_criterion_idx
  on call_analysis_bant_bullets (criterion_id);

create table if not exists call_analysis_blocks (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references call_analyses (id) on delete cascade,
  block_number int not null,
  title text not null,
  constraint call_analysis_block_number_check check (block_number between 1 and 5)
);

create unique index if not exists call_analysis_blocks_unique
  on call_analysis_blocks (analysis_id, block_number);

create index if not exists call_analysis_blocks_analysis_idx
  on call_analysis_blocks (analysis_id);

create table if not exists call_analysis_section_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references call_analysis_blocks (id) on delete cascade,
  section text not null,
  text text not null,
  notes text,
  constraint call_analysis_section_check check (
    section in ('client_insights', 'sales_good_actions', 'sales_bad_actions')
  )
);

create index if not exists call_analysis_section_items_block_idx
  on call_analysis_section_items (block_id);

create table if not exists call_analysis_time_ranges (
  id uuid primary key default gen_random_uuid(),
  section_item_id uuid not null references call_analysis_section_items (id) on delete cascade,
  start_time text not null,
  end_time text not null,
  constraint call_analysis_time_start_check check (start_time ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$'),
  constraint call_analysis_time_end_check check (end_time ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$')
);

create index if not exists call_analysis_time_ranges_item_idx
  on call_analysis_time_ranges (section_item_id);

create table if not exists call_analysis_recommendations (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references call_analysis_blocks (id) on delete cascade,
  text text not null,
  priority text,
  constraint call_analysis_recommendations_priority_check check (
    priority is null or priority in ('low', 'medium', 'high')
  )
);

create index if not exists call_analysis_recommendations_block_idx
  on call_analysis_recommendations (block_id);

alter table call_analyses enable row level security;
create policy call_analyses_org_isolation
  on call_analyses
  for select
  using (org_id = (select org_id from profiles where user_id = auth.uid()));
create policy call_analyses_org_insert
  on call_analyses
  for insert
  with check (org_id = (select org_id from profiles where user_id = auth.uid()));
create policy call_analyses_org_update
  on call_analyses
  for update
  using (org_id = (select org_id from profiles where user_id = auth.uid()));
create policy call_analyses_org_delete
  on call_analyses
  for delete
  using (org_id = (select org_id from profiles where user_id = auth.uid()));

alter table call_analysis_bant_criteria enable row level security;
create policy call_analysis_bant_criteria_org_isolation
  on call_analysis_bant_criteria
  for select
  using (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_bant_criteria_org_insert
  on call_analysis_bant_criteria
  for insert
  with check (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_bant_criteria_org_update
  on call_analysis_bant_criteria
  for update
  using (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_bant_criteria_org_delete
  on call_analysis_bant_criteria
  for delete
  using (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );

alter table call_analysis_bant_bullets enable row level security;
create policy call_analysis_bant_bullets_org_isolation
  on call_analysis_bant_bullets
  for select
  using (
    criterion_id in (
      select c.id
      from call_analysis_bant_criteria c
      join call_analyses a on a.id = c.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_bant_bullets_org_insert
  on call_analysis_bant_bullets
  for insert
  with check (
    criterion_id in (
      select c.id
      from call_analysis_bant_criteria c
      join call_analyses a on a.id = c.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_bant_bullets_org_update
  on call_analysis_bant_bullets
  for update
  using (
    criterion_id in (
      select c.id
      from call_analysis_bant_criteria c
      join call_analyses a on a.id = c.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_bant_bullets_org_delete
  on call_analysis_bant_bullets
  for delete
  using (
    criterion_id in (
      select c.id
      from call_analysis_bant_criteria c
      join call_analyses a on a.id = c.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );

alter table call_analysis_blocks enable row level security;
create policy call_analysis_blocks_org_isolation
  on call_analysis_blocks
  for select
  using (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_blocks_org_insert
  on call_analysis_blocks
  for insert
  with check (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_blocks_org_update
  on call_analysis_blocks
  for update
  using (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_blocks_org_delete
  on call_analysis_blocks
  for delete
  using (
    analysis_id in (
      select id from call_analyses
      where org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );

alter table call_analysis_section_items enable row level security;
create policy call_analysis_section_items_org_isolation
  on call_analysis_section_items
  for select
  using (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_section_items_org_insert
  on call_analysis_section_items
  for insert
  with check (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_section_items_org_update
  on call_analysis_section_items
  for update
  using (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_section_items_org_delete
  on call_analysis_section_items
  for delete
  using (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );

alter table call_analysis_time_ranges enable row level security;
create policy call_analysis_time_ranges_org_isolation
  on call_analysis_time_ranges
  for select
  using (
    section_item_id in (
      select s.id
      from call_analysis_section_items s
      join call_analysis_blocks b on b.id = s.block_id
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_time_ranges_org_insert
  on call_analysis_time_ranges
  for insert
  with check (
    section_item_id in (
      select s.id
      from call_analysis_section_items s
      join call_analysis_blocks b on b.id = s.block_id
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_time_ranges_org_update
  on call_analysis_time_ranges
  for update
  using (
    section_item_id in (
      select s.id
      from call_analysis_section_items s
      join call_analysis_blocks b on b.id = s.block_id
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_time_ranges_org_delete
  on call_analysis_time_ranges
  for delete
  using (
    section_item_id in (
      select s.id
      from call_analysis_section_items s
      join call_analysis_blocks b on b.id = s.block_id
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );

alter table call_analysis_recommendations enable row level security;
create policy call_analysis_recommendations_org_isolation
  on call_analysis_recommendations
  for select
  using (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_recommendations_org_insert
  on call_analysis_recommendations
  for insert
  with check (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_recommendations_org_update
  on call_analysis_recommendations
  for update
  using (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
create policy call_analysis_recommendations_org_delete
  on call_analysis_recommendations
  for delete
  using (
    block_id in (
      select b.id
      from call_analysis_blocks b
      join call_analyses a on a.id = b.analysis_id
      where a.org_id = (select org_id from profiles where user_id = auth.uid())
    )
  );
