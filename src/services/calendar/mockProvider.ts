import type { CalendarEvent } from '../../domain/types';
import type { CalendarProvider } from './types';

/** Demo events anchored to the current time, so Coming up always has content. */
export function createMockCalendarProvider(): CalendarProvider {
  const at = (base: Date, h: number, m: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
  return {
    name: 'mock',
    async listEvents(from, to) {
      const events: CalendarEvent[] = [];
      for (let day = -1; day <= 1; day++) {
        const base = new Date(from.getFullYear(), from.getMonth(), from.getDate() + day);
        const slots: [number, number, number, string, string?][] = [
          [9, 30, 30, 'Team stand-up'],
          [11, 0, 60, 'Zurich ventilation review', 'Video call'],
          [13, 0, 60, 'Lunch with Marc'],
          [15, 0, 45, 'Call with investor', 'Video call'],
          [16, 30, 30, 'CBRE follow-up'],
          [18, 0, 120, 'Dinner', 'Brasserie Zédel'],
        ];
        for (const [h, m, mins, title, location] of slots) {
          const start = at(base, h, m);
          events.push({
            id: `mock-${day}-${h}${m}`,
            title,
            start: start.toISOString(),
            end: new Date(start.getTime() + mins * 60_000).toISOString(),
            allDay: false,
            location: location ?? null,
          });
        }
      }
      return events.filter((e) => new Date(e.end) > from && new Date(e.start) < to);
    },
  };
}
