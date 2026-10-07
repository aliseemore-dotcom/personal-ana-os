-- Personal OS · TODAY v1
-- Every row belongs to a user (auth.uid()) and is protected by Row Level Security,
-- so the same schema works for one person now and several later.
-- Documents are NOT stored here: later, add a `documents` table holding references
-- (Google Drive file id, url, mime type) and link it to tasks/projects.

create extension if not exists pgcrypto;

create type task_status as enum ('inbox', 'backlog', 'planned', 'in_progress', 'waiting', 'done');
create type task_priority as enum ('high', 'medium', 'low');

-- Reserved so projects can roll up into goals later.
create table goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null,
  created_at timestamptz not null default now()
);

create table projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id    uuid references goals on delete set null,
  name       text not null,
  created_at timestamptz not null default now()
);

create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  title              text not null,
  description        text,
  status             task_status   not null default 'planned',
  priority           task_priority not null default 'medium',
  deadline           timestamptz,
  scheduled_date     date,
  estimated_duration integer check (estimated_duration is null or estimated_duration > 0), -- minutes
  project_id         uuid references projects on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_activity_at   timestamptz not null default now(),
  completed_at       timestamptz,
  impact_score       smallint not null default 5 check (impact_score between 1 and 10),
  blocks_others      boolean not null default false,
  blocks_note        text,
  is_focus           boolean not null default false,
  source             text not null default 'manual'
);

create index tasks_user_status_idx on tasks (user_id, status);
create index tasks_user_deadline_idx on tasks (user_id, deadline) where status <> 'done';
-- At most one Focus of the Day per user.
create unique index tasks_one_focus_per_user on tasks (user_id) where is_focus;

create table inbox_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  content    text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  status     text not null default 'inbox' -- later: classified into task / idea / note / project / other
);
create index inbox_user_created_idx on inbox_items (user_id, created_at desc);

create table daily_answers (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date not null,
  question   text not null,
  answer     text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger tasks_touch before update on tasks
  for each row execute function touch_updated_at();
create trigger daily_answers_touch before update on daily_answers
  for each row execute function touch_updated_at();

-- Atomically make one task the focus (or clear it with null).
create or replace function set_focus(task_id uuid) returns void
language plpgsql security invoker as $$
begin
  update tasks set is_focus = false where is_focus and user_id = auth.uid();
  if task_id is not null then
    update tasks set is_focus = true, last_activity_at = now()
    where id = task_id and user_id = auth.uid();
  end if;
end $$;

-- Row Level Security: a user only ever sees and changes their own rows.
alter table goals         enable row level security;
alter table projects      enable row level security;
alter table tasks         enable row level security;
alter table inbox_items   enable row level security;
alter table daily_answers enable row level security;

create policy "own goals"    on goals         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own projects" on projects      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks"    on tasks         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own inbox"    on inbox_items   for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own answers"  on daily_answers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
