# Personal OS — TODAY, TASKS and PROJECTS pages

One question: **what requires my attention right now?** Built with the Rose Glass design system (`docs/brand`; tokens and components in `src/styles`).

```bash
npm install
npm run dev        # runs on a local demo store, no setup needed
npm test           # logic tests (attention rules, scoring, today model, actions)
npm run build
```

## Connect Supabase
1. Run `supabase/migrations/0001_today_v1.sql`, then `0002_tasks_v1.sql` and `0003_projects_v1.sql` (tables, one-focus index, `set_focus()` RPC, people, task history, RLS on every table).
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Enable email auth in Supabase; the app shows a magic-link sign-in because RLS requires a user.

## Architecture
| Layer | Where | Notes |
|---|---|---|
| UI | `src/components/today/*` | Composition and rendering only |
| Prioritisation | `src/logic/prioritisation.ts` | Additive score; returns *reasons*, shown as "Why this matters" |
| Attention rules | `src/logic/attention.ts` | Overdue / waiting (5 working days) / lost attention (5 days) / stale backlog (>30 days); thresholds configurable. Lost + stale display as "Forgotten" |
| Today sections | `src/logic/todayModel.ts` | 1 focus, max 3 priority, quick tasks (≤15 min); manual focus overrides suggestion |
| Action meaning | `src/logic/taskActions.ts` | Complete / reschedule / backlog / do as pure patches |
| Data | `src/data/*` | `Repository` interface; Supabase and local-demo implementations |
| Calendar | `src/services/calendar/*` | `CalendarProvider` interface; mock + Google provider; `CalendarService` slides the 4-hour window with the clock |
| State | `src/state/*` | Optimistic updates with rollback; clock tick every minute |
| Copy | `src/strings.ts` | All text in one place |

## TASKS page
Same task records as TODAY (one store, two views): scheduling for today on TASKS shows on TODAY; completing on TODAY shows as Done on TASKS.

| Piece | Where | Notes |
|---|---|---|
| Assistant summary | `logic/summary.ts` | Interprets the data (overload, overdue, stale, waiting, inbox…), max 4 observations plus one recommendation |
| Needs decision | `logic/decisions.ts` | One row per task under its most severe reason; actions depend on the reason (e.g. waiting: Follow up / Keep waiting / Schedule / Drop) |
| Kanban | `components/tasks/Board.tsx` | Native drag-and-drop, plus a "Move task" menu on every card; Done is collapsed by default |
| In progress limit | `logic/wip.ts`, `WipDialog` | Over the limit it asks what should stop (Pause / Backlog / Complete / Continue anyway); it never blocks |
| Filters and search | `logic/filters.ts` | Facets combine; words match in any order |
| Weekly cleanup | `logic/cleanup.ts` | Queue of stale/ambiguous work, one decision at a time |
| History | `logic/bookkeeping.ts` | Every change passes through `applyChange`, which keeps `waiting_since`, `backlog_since`, `reschedule_count` and appends task events |
| Thresholds | `logic/thresholds.ts` | All limits (5 working days, 30 days, WIP 5, …) in one place |

## PROJECTS page
Routes: `#projects` (card grid), `#projects/<project>` (Project HQ), `#projects/<project>/<workstream>` (the same HQ scoped to one opportunity, location, trip or workstream).

| Piece | Where | Notes |
|---|---|---|
| Model | `domain/types.ts` | Project → Workstream → Tasks / Notes / Documents / Decisions / People links / Events. `cover_image` is reserved; v1 draws a branded placeholder |
| Health | `logic/projectHealth.ts` | Computed from overdue tasks, milestone date, blocker, next action, waiting and inactivity. A stored manual health is the floor. A missing Next Action is noted, but alone does not mark a project as unhealthy |
| Summary | `logic/projectsSummary.ts` | Calm interpretation ("Restaurant Expansion has been waiting for 9 days. Consider scheduling a follow-up.") |
| Shared records | `ProjectsProvider` + `TasksProvider` | Tasks and people are the same records used by TODAY and TASKS. A person is linked to a project through `project_people`; the relationship lives on the link |
| Timeline | `logic/projectViews.ts` | Stored events plus task completions read from the tasks themselves |
| Containers | `workstream_kind` | Opportunities, locations, trips or workstreams are child records, never top-level cards. Specialist fields go in `metadata` |

## Notes and decisions
- **Language:** the brand book says UI copy is Russian; the spec's examples are English, so v1 ships in English with all copy in `strings.ts` so a Russian set can drop in. Labels are sentence case per the brand (no all-caps).
- **Quick capture** writes to `inbox_items` (id, content, created_at, status=`inbox`). Press `C` to open it.
- **Daily question** is chosen by day-of-year; answers are stored with date + question (`daily_answers`; `listDailyAnswers` exists, no history UI yet).
- **Reschedule** also moves a deadline that would still be in the past, otherwise the task would stay "overdue".
- **Google Calendar** provider is written but untested against a live account; set `VITE_CALENDAR_PROVIDER=google` and supply a token source in `src/services/calendar/index.ts`.
- **Inbox:** raw captures from the "+" button and tasks with status Inbox share the Inbox column. Moving a capture anywhere turns it into a task.
- **Rescheduling:** only moving a planned date later counts as a reschedule (3 or more flags repeated postponement).
- **"Keep" / "Keep waiting"** record a review, which restarts the idle clocks for that task.
- **TODAY** folds extra planned tasks behind "N more planned for today" instead of hiding them.
- **Seed data:** project names, categories, workstreams and the Watford decision come from the brief. Opportunities carry no invented deal data. Demo tasks, two linked people and the Hotel & Investment Pipeline / Restaurant Expansion brief lines are example content.
- **Documents** accept only http(s) links, stored as references.
- Added beyond the spec: `blocks_note` (human reason for "blocks others"), `user_id` on every table, minimal `projects`/`goals` tables.
