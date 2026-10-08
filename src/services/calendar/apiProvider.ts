import type { CalendarEvent } from '../../domain/types';
import type { CalendarProvider } from './types';

/** What to tell the person: a setting to fix, a permission to grant, or just a temporary problem. */
export type CalendarProblemKind = 'not_configured' | 'auth_failed' | 'api_disabled' | 'not_shared' | 'unavailable';

const BY_ERROR: Record<string, CalendarProblemKind> = {
  calendar_not_configured: 'not_configured',
  calendar_auth_failed: 'auth_failed',
  calendar_api_disabled: 'api_disabled',
  calendar_not_shared: 'not_shared',
};

export class CalendarUnavailable extends Error {
  constructor(public kind: CalendarProblemKind) {
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
      if (!res.ok) {
        const code = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? '';
        throw new CalendarUnavailable(BY_ERROR[code] ?? 'unavailable');
      }
      return ((await res.json()) as { events: CalendarEvent[] }).events;
    },
  };
}
