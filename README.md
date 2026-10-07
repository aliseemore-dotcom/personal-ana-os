# Personal OS — TODAY and TASKS pages

One question: **what requires my attention right now?** Built with the Rose Glass design system (`docs/brand`; tokens and components in `src/styles`).

```bash
npm install
npm run dev        # runs on a local demo store, no setup needed
npm test           # logic tests (attention rules, scoring, today model, actions)
npm run build
```

## Connect Supabase
1. Run `supabase/migrations/0001_today_v1.sql`, then `0002_tasks_v1.sql` (tables, one-focus index, `set_focus()` RPC, people, task history, RLS on every table).
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
- Added beyond the spec: `blocks_note` (human reason for "blocks others"), `user_id` on every table, minimal `projects`/`goals` tables.
