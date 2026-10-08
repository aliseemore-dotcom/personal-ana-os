import type { CalendarEvent } from '../src/domain/types.js';
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
