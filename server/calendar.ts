import type { CalendarEvent } from '../src/domain/types.js';
import { londonDayRange } from '../src/domain/london.js';
import { ConfigError, createTokenSource, googleCall, googleConfigFromEnv, UpstreamError } from './sheets/client.js';

/**
 * Calendar events, read on the server with the same service account as the Data Hub
 * (scope: calendar.readonly). The calendar must be shared with the service account's email.
 * The browser only ever calls /api/calendar and never holds a Google token.
 */
export interface CalendarSource {
  listEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  eventType?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

const API = 'https://www.googleapis.com/calendar/v3/calendars';

/** Google event → application event. Returns null for things that are not commitments on the day. */
export function mapGoogleEvent(e: GoogleEvent): CalendarEvent | null {
  if (e.status === 'cancelled') return null;
  if (e.eventType === 'workingLocation') return null;
  if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return null;
  const startRaw = e.start?.dateTime ?? e.start?.date;
  const endRaw = e.end?.dateTime ?? e.end?.date;
  if (!startRaw || !endRaw) return null;
  const allDay = !e.start?.dateTime;
  const iso = (v: string) => (allDay ? new Date(`${v}T00:00:00`).toISOString() : new Date(v).toISOString());
  return {
    id: e.id,
    // A calendar shared as free/busy only has no title; say so plainly instead of leaving it blank.
    title: e.summary?.trim() || 'Busy',
    start: iso(startRaw),
    end: iso(endRaw),
    allDay,
    location: e.location?.trim() || null,
  };
}

export function createGoogleCalendarSource(cfg: { calendarId: string; serviceAccountEmail: string; privateKey: string }, fetchImpl: typeof fetch = fetch): CalendarSource {
  const token = createTokenSource(cfg, 'https://www.googleapis.com/auth/calendar.readonly', fetchImpl);
  return {
    async listEvents(from, to) {
      const qs = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
        fields: 'items(id,status,summary,location,eventType,attendees(self,responseStatus),start,end)',
      });
      const res = await googleCall(fetchImpl, `${API}/${encodeURIComponent(cfg.calendarId)}/events?${qs}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      return ((res.items ?? []) as GoogleEvent[]).map(mapGoogleEvent).filter((e): e is CalendarEvent => e !== null);
    },
  };
}

export interface CalendarResult {
  events: CalendarEvent[];
  /** Google could not be reached; these are the last events we had for this window. */
  stale: boolean;
}

/** A short cache so the page's refreshes cost Google one call a minute, and a last-good fallback. */
export function withCache(source: CalendarSource, ttlMs = 60_000, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; events: CalendarEvent[] }>();
  return {
    async get(from: Date, to: Date): Promise<CalendarResult> {
      const key = `${from.toISOString()}|${to.toISOString()}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttlMs) return { events: hit.events, stale: false };
      try {
        const events = await source.listEvents(from, to);
        cache.set(key, { at: now(), events });
        if (cache.size > 20) cache.delete(cache.keys().next().value as string);
        return { events, stale: false };
      } catch (e) {
        if (hit) return { events: hit.events, stale: true };
        throw e;
      }
    },
  };
}

let singleton: ReturnType<typeof withCache> | null = null;

/** The calendar for this deployment, from environment variables. Needs GOOGLE_CALENDAR_ID. */
export function calendarFromEnv(env: Record<string, string | undefined> = process.env) {
  if (singleton) return singleton;
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim();
  if (!calendarId) throw new ConfigError(['GOOGLE_CALENDAR_ID']);
  const g = googleConfigFromEnv(env);
  singleton = withCache(createGoogleCalendarSource({ calendarId, serviceAccountEmail: g.serviceAccountEmail, privateKey: g.privateKey }));
  return singleton;
}

export { UpstreamError };

/** What went wrong, in terms a person can act on. Never includes keys, tokens or raw Google text. */
export type CalendarFault = 'calendar_not_configured' | 'calendar_auth_failed' | 'calendar_api_disabled' | 'calendar_not_shared' | 'upstream';

export function classifyCalendarError(e: unknown): CalendarFault {
  if (e instanceof ConfigError) return 'calendar_not_configured';
  if (e instanceof UpstreamError) {
    // The service account could not even get a token: wrong or revoked key, or the machine clock is off.
    if (e.stage === 'token' && e.status && e.status >= 400 && e.status < 500) return 'calendar_auth_failed';
    if (e.stage === 'api') {
      if (e.reason === 'accessNotConfigured' || e.reason === 'SERVICE_DISABLED' || e.reason === 'PERMISSION_DENIED' && /has not been used|is disabled/i.test(e.message)) return 'calendar_api_disabled';
      if (e.status === 404 || e.status === 403) return 'calendar_not_shared';
      if (e.status === 401) return 'calendar_auth_failed';
    }
  }
  return 'upstream';
}

export interface DiagnosticStep {
  step: string;
  ok: boolean;
  /** A short, safe explanation or hint. */
  detail?: string;
}

const HINTS: Record<CalendarFault, string> = {
  calendar_not_configured: 'Set GOOGLE_CALENDAR_ID (and the service account variables) in Vercel, then redeploy.',
  calendar_auth_failed: 'Google refused the service account key. Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.',
  calendar_api_disabled: 'Enable the Google Calendar API in the same Google Cloud project as the service account.',
  calendar_not_shared: 'Share the calendar with the service account email ("See all event details"), and check GOOGLE_CALENDAR_ID.',
  upstream: 'Google could not be reached or answered with an error. Try again shortly; see the server log.',
};
export const hintFor = (f: CalendarFault) => HINTS[f];

/**
 * Walks the same path the dashboard uses, one step at a time, so a missing permission is named
 * instead of guessed at. Safe to show to the signed-in owner: no secrets, no event titles.
 */
export async function diagnoseCalendar(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch, now: Date = new Date()): Promise<{ ok: boolean; serviceAccount: string | null; calendarId: string | null; eventsToday: number | null; steps: DiagnosticStep[] }> {
  const steps: DiagnosticStep[] = [];
  const serviceAccount = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null;
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim() || null;
  const out = (ok: boolean, eventsToday: number | null = null) => ({ ok, serviceAccount, calendarId, eventsToday, steps });
  let cfg;
  try {
    const calId = env.GOOGLE_CALENDAR_ID?.trim();
    if (!calId) throw new ConfigError(['GOOGLE_CALENDAR_ID']);
    cfg = { ...googleConfigFromEnv(env), calendarId: calId };
    steps.push({ step: 'configuration', ok: true });
  } catch (e) {
    steps.push({ step: 'configuration', ok: false, detail: e instanceof ConfigError ? `missing: ${e.missing.join(', ')}` : 'invalid' });
    return out(false);
  }
  const { from, to } = londonDayRange(now);
  try {
    const source = createGoogleCalendarSource({ calendarId: cfg.calendarId, serviceAccountEmail: cfg.serviceAccountEmail, privateKey: cfg.privateKey }, fetchImpl);
    // Token and events in one call; the fault tells us which step failed.
    const events = await source.listEvents(from, to);
    steps.push({ step: 'access token', ok: true }, { step: 'read calendar', ok: true, detail: `${events.length} event(s) today in Europe/London` });
    return out(true, events.length);
  } catch (e) {
    const fault = classifyCalendarError(e);
    console.error('[calendar] diagnose', (e as Error).message);
    const tokenFailed = fault === 'calendar_auth_failed' || (e as UpstreamError)?.stage === 'token';
    steps.push({ step: 'access token', ok: !tokenFailed, detail: tokenFailed ? HINTS[fault] : undefined });
    if (!tokenFailed) steps.push({ step: 'read calendar', ok: false, detail: HINTS[fault] });
    return out(false);
  }
}
