import type { CalendarEvent } from '../../domain/types';
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

  /** Pull from the provider: from the start of today to the end of tomorrow. */
  async refresh(now: Date = new Date()): Promise<void> {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    this.cache = await this.provider.listEvents(from, to);
    this.listeners.forEach((l) => l());
  }

  /** Events that are in progress or start within `hours`, soonest first. All-day events are skipped. */
  upcoming(now: Date, hours: number): CalendarEvent[] {
    const horizon = now.getTime() + hours * 3_600_000;
    return this.cache
      .filter((e) => !e.allDay && new Date(e.end).getTime() > now.getTime() && new Date(e.start).getTime() <= horizon)
      .sort((a, b) => a.start.localeCompare(b.start));
  }
}
