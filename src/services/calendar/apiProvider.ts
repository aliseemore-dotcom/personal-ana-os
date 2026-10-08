import type { CalendarEvent } from '../../domain/types';
import type { CalendarProvider } from './types';

export class CalendarUnavailable extends Error {
  /** `not_connected`: not set up or not shared yet. `unavailable`: a temporary problem. */
  constructor(public kind: 'not_connected' | 'unavailable') {
    super(kind);
  }
}

/**
 * Events come from our own /api/calendar, which reads Google Calendar on the server.
 * No Google token or credential ever reaches the browser.
 */
export function createApiCalendarProvider(opts: { getKey: () => string | null; onUnauthorised: () => void; fetchImpl?: typeof fetch }): CalendarProvider {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    name: 'google (via api)',
    async listEvents(from, to) {
      const key = opts.getKey();
      let res: Response;
      try {
        res = await doFetch(`/api/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          credentials: 'same-origin',
        });
      } catch {
        throw new CalendarUnavailable('unavailable');
      }
      if (res.status === 401) {
        opts.onUnauthorised();
        throw new CalendarUnavailable('unavailable');
      }
      if (res.status === 503) throw new CalendarUnavailable('not_connected');
      if (!res.ok) throw new CalendarUnavailable('unavailable');
      return ((await res.json()) as { events: CalendarEvent[] }).events;
    },
  };
}
