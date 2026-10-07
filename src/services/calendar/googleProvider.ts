import type { CalendarEvent } from '../../domain/types';
import type { CalendarProvider } from './types';

interface GoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Google Calendar via the REST API (calendar.events.readonly scope).
 * `getAccessToken` is injected so the token source (Supabase Google sign-in, an
 * Edge Function, a backend session) can change without touching this class.
 * NOTE: not exercised against a live account in v1 — wire a token source and test.
 */
export function createGoogleCalendarProvider(
  getAccessToken: () => Promise<string | null>,
  calendarId = 'primary',
): CalendarProvider {
  return {
    name: 'google',
    async listEvents(from, to) {
      const token = await getAccessToken();
      if (!token) throw new Error('Google Calendar is not connected');
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Google Calendar responded ${res.status}`);
      const body = (await res.json()) as { items?: GoogleEvent[] };
      return (body.items ?? [])
        .filter((e) => e.status !== 'cancelled')
        .map<CalendarEvent>((e) => ({
          id: e.id,
          title: e.summary || 'Busy',
          start: e.start.dateTime ?? new Date(`${e.start.date}T00:00:00`).toISOString(),
          end: e.end.dateTime ?? new Date(`${e.end.date}T00:00:00`).toISOString(),
          allDay: !e.start.dateTime,
          location: e.location ?? null,
        }));
    },
  };
}
