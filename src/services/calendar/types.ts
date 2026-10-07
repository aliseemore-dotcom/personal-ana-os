import type { CalendarEvent } from '../../domain/types';

/**
 * A calendar provider only knows how to fetch events in a time range.
 * Swap Google for Outlook/iCal by implementing this one method; the Today page
 * depends only on CalendarService, never on a provider.
 */
export interface CalendarProvider {
  readonly name: string;
  listEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
}
