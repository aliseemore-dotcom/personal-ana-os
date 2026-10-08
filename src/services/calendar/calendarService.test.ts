import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../../domain/types';
import { CalendarService } from './calendarService';
import { CalendarUnavailable, createApiCalendarProvider } from './apiProvider';

const ev = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: id, start, end, allDay: false, ...extra });

async function serviceWith(events: CalendarEvent[]) {
  const asked: { from: string; to: string }[] = [];
  const s = new CalendarService({ name: 't', listEvents: async (from, to) => { asked.push({ from: from.toISOString(), to: to.toISOString() }); return events; } });
  return { s, asked };
}

describe('today in London', () => {
  const now = new Date('2026-10-08T13:30:00Z'); // 14:30 in London (BST)
  it('asks for London’s whole day, not the machine’s', async () => {
    const { s, asked } = await serviceWith([]);
    await s.refresh(now);
    expect(asked[0]).toEqual({ from: '2026-10-07T23:00:00.000Z', to: '2026-10-08T23:00:00.000Z' });
  });
  it('lists the rest of today in order: running now, then later, never finished or all-day ones', async () => {
    const { s } = await serviceWith([
      ev('later', '2026-10-08T17:00:00Z', '2026-10-08T18:00:00Z'),
      ev('done', '2026-10-08T08:00:00Z', '2026-10-08T09:00:00Z'),
      ev('running', '2026-10-08T13:00:00Z', '2026-10-08T14:00:00Z'),
      ev('holiday', '2026-10-07T23:00:00Z', '2026-10-08T23:00:00Z', { allDay: true }),
      ev('soon', '2026-10-08T14:00:00Z', '2026-10-08T15:00:00Z'),
      ev('tomorrow', '2026-10-09T09:00:00Z', '2026-10-09T10:00:00Z'),
    ]);
    await s.refresh(now);
    expect(s.upcomingToday(now).map((e) => e.id)).toEqual(['running', 'soon', 'later']);
  });
  it('moves with the clock: a meeting that finishes leaves the list without a new request', async () => {
    const { s, asked } = await serviceWith([ev('a', '2026-10-08T13:00:00Z', '2026-10-08T14:00:00Z'), ev('b', '2026-10-08T15:00:00Z', '2026-10-08T16:00:00Z')]);
    await s.refresh(now);
    expect(s.upcomingToday(new Date('2026-10-08T13:59:00Z')).map((e) => e.id)).toEqual(['a', 'b']);
    expect(s.upcomingToday(new Date('2026-10-08T14:01:00Z')).map((e) => e.id)).toEqual(['b']);
    expect(asked).toHaveLength(1);
  });
  it('a meeting at 00:30 London time belongs to the new day, not the old one', async () => {
    const { s } = await serviceWith([ev('late', '2026-10-08T23:30:00Z', '2026-10-09T00:30:00Z')]);
    const evening = new Date('2026-10-08T20:00:00Z'); // 21:00 London, still the 8th
    await s.refresh(evening);
    expect(s.upcomingToday(evening)).toHaveLength(0);
  });
});

describe('api provider problems', () => {
  const from = new Date('2026-10-08T00:00:00Z'), to = new Date('2026-10-09T00:00:00Z');
  const withResponse = (status: number, body: unknown) =>
    createApiCalendarProvider({ getKey: () => 'k', onUnauthorised: () => undefined, fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch });
  it('turns each server answer into the right problem', async () => {
    for (const [code, kind] of [['calendar_not_configured', 'not_configured'], ['calendar_not_shared', 'not_shared'], ['calendar_api_disabled', 'api_disabled'], ['calendar_auth_failed', 'auth_failed'], ['upstream', 'unavailable']] as const) {
      await expect(withResponse(code === 'upstream' ? 502 : 503, { error: code }).listEvents(from, to)).rejects.toMatchObject({ kind });
    }
    await expect(withResponse(502, 'not json').listEvents(from, to)).rejects.toBeInstanceOf(CalendarUnavailable);
  });
});
