# Google Sheets Data Hub

The sheet **Anastasija Personal OS — Data Hub** is the source of truth for the current Personal OS.
The dashboard is the presentation and interaction layer.

```
Google Sheets ──► server/ (Vercel functions, credentials live here only)
                    │  readRecords → build* mappers → normalised objects
                    ▼
                /api/data  /api/write      ← the only thing the browser talks to
                    ▼
        src/data/httpRepository.ts  (implements the same Repository the UI always used)
                    ▼
              TODAY · TASKS · PROJECTS
```

The UI never calls Google and never sees a column letter. To move to Supabase later, replace
`server/hub.ts`'s implementation (or switch `VITE_DATA_SOURCE=supabase`): the pages do not change.

## Sheets and columns

Sheet names are fixed: `Tasks`, `Projects`, `Workstreams`, `Decisions`, `Notes`, `Daily_Questions`, `Sync_Log`.
Columns are matched **by header name**, never by position, so reordering or adding columns is safe.
Records are located by their stable id (`task_id`, `project_id`, `workstream_id`, `decision_id`, `note_id`),
never by row number. The app never renames a sheet or a column.

The expected columns are declared once in `server/sheets/schema.ts`. A column that is missing is treated as
empty (and logged on the server); an extra column is kept (for workstreams it appears as metadata).
Run `npm run sheets:check` to see how your real sheet maps. It prints names and counts, never cell values.

Tolerated formats: ISO dates, `07/10/2026` (day first), `15 Oct 2026`, Sheets date cells, `TRUE/FALSE`,
`yes/no`, checkboxes, and statuses typed by hand (`In Progress` → `in_progress`).

## Setup

1. **Google Cloud**: create a project, enable the *Google Sheets API*, create a *service account*, add a JSON key.
2. **Share the sheet** with the service account's email. Viewer is enough for reading; use Editor only if you turn writes on.
   Keep the sheet private. Do not publish it or share it by link.
3. **Vercel → Settings → Environment Variables** (all environments):

   | Variable | Value |
   |---|---|
   | `VITE_DATA_SOURCE` | `sheets` |
   | `GOOGLE_SHEETS_ID` | `1vEI4gZAxevu4MUCouY71azAZ1pypAtmPPmEQ8ErtNoY` |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
   | `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key |
   | `DASHBOARD_ACCESS_KEY` | a long random string (`openssl rand -base64 32`) |
   | `GOOGLE_SHEETS_WRITE` | `false` for read-only, `true` to enable write-back |

4. Deploy. Open the site, enter the access key once, and check *Last synced* in the top bar.
5. Recommended in addition: turn on **Vercel Authentication** (Deployment Protection) so only you can reach the site at all.

Nothing secret is in the repository. `.env*` files are git-ignored, and none of the Google variables start with `VITE_`.

## Google Calendar ("Coming up")

Events are read **on the server** with the same service account, with the read-only calendar scope, through
`/api/calendar`. The browser never holds a Google token and never calls Google.

1. In the same Google Cloud project, enable the **Google Calendar API**.
2. In Google Calendar (web): *Settings → your calendar → Share with specific people* and add the service account's email
   with **See all event details**. ("See only free/busy" also works, but every event then shows as *Busy*.)
3. In Vercel add `GOOGLE_CALENDAR_ID` = the calendar's id (*Settings → Integrate calendar → Calendar ID*, usually your email address),
   and redeploy. Do not use `primary`: for a service account that means its own, empty calendar.
4. Leave `VITE_CALENDAR_PROVIDER` unset. With `VITE_DATA_SOURCE=sheets` the calendar comes from Google; demo events appear only when
   you set it to `mock` or run on local demo data.

**What the page shows.** Today's meetings that have not finished yet, soonest first, in **Europe/London** time whatever timezone the
browser is in (including the days the clocks change). Each shows its title, start, end ("until 15:45") and the location when there is one.
All-day entries, cancelled events, events you declined and working-location entries are left out. The list is refreshed every 60 seconds
and moves with the clock: a meeting that finishes leaves the list without a new request. Google itself is asked at most every 30 seconds.
There is no calendar database; events are read live and held only in memory.

**Checking it for real.** Nothing replaces trying it with your own credentials:

- `npm run calendar:check` (with the variables in `.env.local`, e.g. from `vercel env pull`) walks *configuration → access token → read
  calendar* and prints today's meetings from your calendar. A ✗ names the step and the fix.
- On the deployed site, `GET /api/calendar?diagnose=1` with `Authorization: Bearer <your access key>` returns the same step-by-step result
  (no secrets and no meeting titles).

**What the page says when something is wrong** (the technical reason is only in the server log):

| Situation | Message on the page |
|---|---|
| `GOOGLE_CALENDAR_ID` or the service account variables missing | Google Calendar is not connected yet. |
| Calendar not shared with the service account, or wrong calendar id | Google Calendar is not shared with the dashboard yet. |
| Calendar API not enabled in the Cloud project | The Google Calendar API is not switched on yet. |
| Google refuses the service account key | Google refused the dashboard's access. Check the service account key. |
| Google temporarily unavailable | Calendar is unavailable right now. (events already loaded stay on screen) |

If your Google Workspace administrator does not allow sharing calendars with outside accounts, step 2 will not work; the
alternatives are domain-wide delegation for the service account or an OAuth sign-in, both of which need the administrator.

## Freshness

The server reads all sheets in one request and keeps the result for 30 seconds (`SHEETS_CACHE_SECONDS`).
The browser asks at most once a minute, when the tab becomes visible, or when you press **Refresh**
(Refresh bypasses the cache but is limited to once every 10 seconds). New sheet data therefore appears
in about 30–60 seconds, with no redeploy.

If Google is unreachable the server returns the last good copy and the top bar says
*Data could not be refreshed. Showing the most recently available information.* The technical error is only in the server log.

## Writes

Off by default. With `GOOGLE_SHEETS_WRITE=true` the app can: complete, reschedule, re-prioritise and change the status of tasks,
change the Focus, create and delete tasks (quick capture creates an Inbox task), update projects and workstreams,
record decisions and notes, and save the answer to the daily question (needs an `answer` column in `Daily_Questions`).

Each write finds its row by id, updates only the cells that changed, and appends a row to `Sync_Log`
(`sync_id`, `timestamp`, `source = personal_os`, `action`, `entity_type`, `entity_id`, `summary`).
Writes use `RAW` input, so text beginning with `=` is stored as text and can never run as a formula.
Writes are applied one at a time on the server so two quick actions never pick the same new id.
New ids follow the sheet's own style (`TASK-036`); if ChatGPT has just used that number the server takes the next free one and the
dashboard reloads.

## Not in the Data Hub yet

The workbook has no sheets for these, so they stay in this browser (`localStorage`) and are **not** shared between devices:
people and their links to projects, documents, task change history, and project events other than those that can be read from the
records themselves (project created, workstream added, decision recorded, note added and task completed are read from the sheet).
Add sheets for them (or move to Supabase) when they should be shared.

## Local development

- `npm run dev:mock` runs the whole stack with an in-memory copy of the hub (no Google account). The access key is `dev-key`.
- `npm run dev` runs on demo data in the browser.
- To try the real sheet locally, put the variables in `.env.local` and use `vercel dev`.
- `npm test` covers the mapping, the hub (caching, stale fallback, row location, ids, Sync_Log), the API (access, errors) and the browser repository end to end.
