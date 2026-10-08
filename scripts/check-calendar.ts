/**
 * A real end-to-end check of the Google Calendar integration, using your actual credentials.
 * Run it where the environment variables are set (your machine with .env.local, or `vercel env pull`).
 *
 *   npm run calendar:check
 *
 * It walks the same path as the dashboard: configuration → access token → read today's events
 * (Europe/London), and names the step and the fix if something is missing.
 * Meeting titles are printed here, on your screen only; the deployed endpoint never returns them.
 */
import { createGoogleCalendarSource, diagnoseCalendar } from '../server/calendar.js';
import { googleConfigFromEnv } from '../server/sheets/client.js';
import { formatLondonTime, londonDayRange } from '../src/domain/london.js';

const d = await diagnoseCalendar(process.env);
console.log(`Service account: ${d.serviceAccount ?? '(not set)'}`);
console.log(`Calendar id:     ${d.calendarId ?? '(not set)'}\n`);
for (const s of d.steps) console.log(`${s.ok ? '✓' : '✗'} ${s.step}${s.detail ? ` — ${s.detail}` : ''}`);

if (!d.ok) {
  console.log('\nThe integration is NOT working yet. Fix the step marked ✗ and run this again.');
  process.exit(1);
}

const cfg = googleConfigFromEnv(process.env);
const source = createGoogleCalendarSource({ calendarId: process.env.GOOGLE_CALENDAR_ID!.trim(), serviceAccountEmail: cfg.serviceAccountEmail, privateKey: cfg.privateKey });
const { from, to } = londonDayRange(new Date());
const events = (await source.listEvents(from, to)).filter((e) => !e.allDay).sort((a, b) => a.start.localeCompare(b.start));
console.log(`\nToday in Europe/London (${events.length} timed event${events.length === 1 ? '' : 's'}):`);
for (const e of events) console.log(`  ${formatLondonTime(e.start)}–${formatLondonTime(e.end)}  ${e.title}${e.location ? `  (${e.location})` : ''}`);
if (events.length === 0) console.log('  none. If you expected some, check that GOOGLE_CALENDAR_ID is the calendar that holds them.');
console.log('\nThe integration works.');
