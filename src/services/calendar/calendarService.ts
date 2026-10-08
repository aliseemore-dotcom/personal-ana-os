import type { CalendarEvent } from '../../domain/types';
import { londonDayRange } from '../../domain/london';
import type { CalendarProvider } from './types';

/**
 * Fetches a generous window once, then answers "what is coming up?" from memory.
 * The window is evaluated against the clock each time, so past events drop off and
 * newly relevant ones appear without any extra network call.
 */
export class CalendarService {
  private cache: CalendarEvent[] = [];
  private listeners = new Set<() => void>();

  constructor(private provider: CalendarProvider) {}

  get providerName() {
    return this.provider.name;
  }

  setProvider(provider: CalendarProvider) {
    this.provider = provider;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /**
   * Pull today's events (London's day, a stable window so the server can cache it).
   * Called every minute; it also crosses midnight correctly because the day is worked out each time.
   */
  async refresh(now: Date = new Date()): Promise<void> {
    const { from, to } = londonDayRange(now);
    this.cache = await this.provider.listEvents(from, to);
    this.listeners.forEach((l) => l());
  }

  /**
   * Today's meetings that have not finished yet, soonest first. All-day entries are not meetings and are left out.
   * Evaluated against the clock on every call, so finished meetings drop away without any new request.
   */
  upcomingToday(now: Date): CalendarEvent[] {
    const { to } = londonDayRange(now);
    return this.cache
      .filter((e) => !e.allDay && new Date(e.end).getTime() > now.getTime() && new Date(e.start).getTime() < to.getTime())
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  }
}
