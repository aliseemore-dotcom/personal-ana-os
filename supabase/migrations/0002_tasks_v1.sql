-- Personal OS · TASKS v1
-- Extends the same tasks table that TODAY uses (no second task store), adds people
-- and an append-only history table, and lets raw captures be linked to the task they became.

alter table tasks
  add column if not exists notes              text,
  add column if not exists assigned_person_id uuid,
  add column if not exists delegated_to       text,
  add column if not exists waiting_since      timestamptz,
  add column if not exists backlog_since      timestamptz,
  add column if not exists reschedule_count   integer not null default 0 check (reschedule_count >= 0),
  add column if not exists last_reviewed_at   timestamptz;

create table people (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

alter table tasks
  add constraint tasks_assigned_person_fk foreign key (assigned_person_id) references people on delete set null;

-- Task history: never edited, only appended. Lets the assistant learn patterns later
-- (e.g. a task postponed again and again) without growing the tasks table.
create type task_event_type as enum (
  'created', 'status_changed', 'deadline_changed', 'scheduled', 'rescheduled',
  'moved_to_today', 'completed', 'reopened', 'delegated', 'priority_changed', 'reviewed'
);

create table task_events (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  task_id   uuid not null references tasks on delete cascade,
  type      task_event_type not null,
  at        timestamptz not null default now(),
  "from"    text,
  "to"      text
);
create index task_events_task_idx on task_events (task_id, at desc);

-- A capture that became a task keeps a pointer to it.
alter table inbox_items add column if not exists task_id uuid references tasks on delete set null;
alter table inbox_items drop constraint if exists inbox_items_status_check;
alter table inbox_items add constraint inbox_items_status_check check (status in ('inbox', 'processed'));

-- Workflow indexes for the attention rules.
create index tasks_user_waiting_idx on tasks (user_id, last_activity_at) where status = 'waiting';
create index tasks_user_backlog_idx on tasks (user_id, backlog_since) where status = 'backlog';

alter table people      enable row level security;
alter table task_events enable row level security;
create policy "own people" on people      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own events" on task_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
