# Personal OS — TODAY page v1

One question: **what requires my attention right now?** Built with the Rose Glass design system (`docs/brand`; tokens and components in `src/styles`).

```bash
npm install
npm run dev        # runs on a local demo store, no setup needed
npm test           # logic tests (attention rules, scoring, today model, actions)
npm run build
```

## Connect Supabase
1. Run `supabase/migrations/0001_today_v1.sql` (tables, one-focus index, `set_focus()` RPC, RLS on every table).
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

## Notes and decisions
- **Language:** the brand book says UI copy is Russian; the spec's examples are English, so v1 ships in English with all copy in `strings.ts` so a Russian set can drop in. Labels are sentence case per the brand (no all-caps).
- **Quick capture** writes to `inbox_items` (id, content, created_at, status=`inbox`). Press `C` to open it.
- **Daily question** is chosen by day-of-year; answers are stored with date + question (`daily_answers`; `listDailyAnswers` exists, no history UI yet).
- **Reschedule** also moves a deadline that would still be in the past, otherwise the task would stay "overdue".
- **Google Calendar** provider is written but untested against a live account; set `VITE_CALENDAR_PROVIDER=google` and supply a token source in `src/services/calendar/index.ts`.
- Added beyond the spec: `blocks_note` (human reason for "blocks others"), `user_id` on every table, minimal `projects`/`goals` tables.
