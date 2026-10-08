import { useEffect, useMemo, useState } from 'react';
import type { CalendarEvent } from '../domain/types';
import { calendarService, CalendarUnavailable } from '../services/calendar';

export type CalendarProblem = import('../services/calendar').CalendarProblemKind | null;

export function useUpcomingEvents(now: Date): { events: CalendarEvent[]; error: CalendarProblem } {
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<CalendarProblem>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      calendarService
        .refresh()
        .then(() => alive && setError(null))
        .catch((e) => alive && setError(e instanceof CalendarUnavailable ? e.kind : 'unavailable'));
    const off = calendarService.subscribe(() => setVersion((v) => v + 1));
    load();
    const id = window.setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      off();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // `now` ticks every minute, so the window slides without refetching.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => calendarService.upcomingToday(now), [now, version]);
  return { events, error };
}
