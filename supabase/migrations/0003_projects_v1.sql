-- Personal OS · PROJECTS v1
-- Extends the projects table created in 0001 and adds the records that hang off a project.
-- Everything references the shared tasks and people tables: nothing is copied per project.
-- Documents are references (URL / Drive id), never binaries.

alter table projects
  add column if not exists category            text not null default 'work'      check (category in ('work', 'business', 'personal')),
  add column if not exists summary             text,
  add column if not exists objective           text,
  add column if not exists status_note         text,
  add column if not exists status              text not null default 'active'    check (status in ('active', 'waiting', 'on_hold', 'completed')),
  -- Manual health set by the user. The health shown in the app also reflects signals
  -- from tasks, milestones and activity, which are computed, not stored.
  add column if not exists health              text not null default 'on_track'  check (health in ('on_track', 'needs_attention', 'blocked')),
  add column if not exists next_action         text,
  add column if not exists blocker             text,
  add column if not exists next_milestone      text,
  add column if not exists next_milestone_date date,
  add column if not exists cover_image         text,
  add column if not exists workstream_kind     text not null default 'workstream' check (workstream_kind in ('workstream', 'opportunity', 'location', 'trip')),
  add column if not exists updated_at          timestamptz not null default now(),
  add column if not exists last_activity_at    timestamptz not null default now();

create trigger projects_touch before update on projects
  for each row execute function touch_updated_at();

-- Opportunity / location / trip / workstream: a child of a project, never a top-level project.
-- Specialist fields (asking price, landlord, travellers…) go in `metadata` until they earn real columns.
create table workstreams (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  project_id       uuid not null references projects on delete cascade,
  name             text not null check (length(btrim(name)) > 0),
  type             text not null default 'workstream' check (type in ('workstream', 'opportunity', 'location', 'trip')),
  status           text not null default 'active' check (status in ('active', 'waiting', 'on_hold', 'completed')),
  health           text not null default 'on_track' check (health in ('on_track', 'needs_attention', 'blocked')),
  summary          text,
  next_action      text,
  blocker          text,
  next_milestone   text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index workstreams_project_idx on workstreams (project_id);
create trigger workstreams_touch before update on workstreams
  for each row execute function touch_updated_at();

-- The same Task record belongs to a project and, optionally, one of its workstreams.
alter table tasks add column if not exists workstream_id uuid references workstreams on delete set null;
create index tasks_project_idx on tasks (user_id, project_id);

alter table people add column if not exists organisation text;

create table project_decisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  project_id    uuid not null references projects on delete cascade,
  workstream_id uuid references workstreams on delete set null,
  date          date not null,
  decision      text not null check (length(btrim(decision)) > 0),
  context       text,
  people_ids    uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index project_decisions_idx on project_decisions (project_id, date desc);

create table project_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  project_id    uuid not null references projects on delete cascade,
  workstream_id uuid references workstreams on delete set null,
  body          text not null check (length(btrim(body)) > 0),
  created_at    timestamptz not null default now()
);
create index project_notes_idx on project_notes (project_id, created_at desc);

create table project_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  project_id    uuid not null references projects on delete cascade,
  workstream_id uuid references workstreams on delete set null,
  name          text not null check (length(btrim(name)) > 0),
  type          text not null default 'document',
  url           text not null check (url ~* '^https?://'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index project_documents_idx on project_documents (project_id);
create trigger project_documents_touch before update on project_documents
  for each row execute function touch_updated_at();

-- A person linked to a project; the person stays one record, the relationship lives here.
create table project_people (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  project_id       uuid not null references projects on delete cascade,
  workstream_id    uuid references workstreams on delete set null,
  person_id        uuid not null references people on delete cascade,
  role             text,
  relationship     text,
  last_interaction date,
  next_action      text
);
create index project_people_idx on project_people (project_id);
create index project_people_person_idx on project_people (person_id);

-- Project timeline. Task completions are read from tasks.completed_at, not stored twice.
create table project_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  project_id    uuid not null references projects on delete cascade,
  workstream_id uuid references workstreams on delete set null,
  type          text not null check (type in (
    'project_created', 'status_changed', 'task_completed', 'decision_recorded',
    'document_added', 'milestone_reached', 'workstream_added', 'note_added')),
  at            timestamptz not null default now(),
  title         text,
  ref_id        uuid
);
create index project_events_idx on project_events (project_id, at desc);

alter table workstreams        enable row level security;
alter table project_decisions  enable row level security;
alter table project_notes      enable row level security;
alter table project_documents  enable row level security;
alter table project_people     enable row level security;
alter table project_events     enable row level security;

create policy "own workstreams" on workstreams       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own decisions"   on project_decisions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notes"       on project_notes     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own documents"   on project_documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own links"       on project_people    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own proj events" on project_events    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
