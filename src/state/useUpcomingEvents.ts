import { useEffect, useMemo, useState } from 'react';
import { config } from '../config';
import type { CalendarEvent } from '../domain/types';
import { calendarService } from '../services/calendar';

export function useUpcomingEvents(now: Date): { events: CalendarEvent[]; error: boolean } {
  const [version, setVersion] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      calendarService
        .refresh()
        .then(() => alive && setError(false))
        .catch(() => alive && setError(true));
    const off = calendarService.subscribe(() => setVersion((v) => v + 1));
    load();
    const id = window.setInterval(load, 5 * 60_000);
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
  const events = useMemo(() => calendarService.upcoming(now, config.comingUpHours), [now, version]);
  return { events, error };
}
