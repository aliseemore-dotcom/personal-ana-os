import { describe, expect, it } from 'vitest';
import { CalendarUnavailable, createApiCalendarProvider } from './apiProvider';

const run = (status: number, body: unknown = {}, key: string | null = 'k') => {
  let unauthorised = 0;
  const calls: { url: string; auth?: string }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  const p = createApiCalendarProvider({ getKey: () => key, onUnauthorised: () => unauthorised++, fetchImpl });
  return { p, calls, unauthorised: () => unauthorised };
};
const from = new Date('2026-10-08T00:00:00Z');
const to = new Date('2026-10-10T00:00:00Z');

describe('calendar api provider', () => {
  it('asks our own API (never Google) with the access key and returns the events', async () => {
    const { p, calls } = run(200, { events: [{ id: '1' }] });
    expect(await p.listEvents(from, to)).toEqual([{ id: '1' }]);
    expect(calls[0].url).toMatch(/^\/api\/calendar\?from=2026-10-08T00%3A00%3A00.000Z&to=/);
    expect(calls[0].auth).toBe('Bearer k');
  });
  it('tells "not connected" from "unavailable", and asks for the key again on 401', async () => {
    await expect(run(503, { error: 'calendar_not_configured' }).p.listEvents(from, to)).rejects.toMatchObject({ kind: 'not_configured' });
    await expect(run(502).p.listEvents(from, to)).rejects.toMatchObject({ kind: 'unavailable' });
    const r = run(401);
    await expect(r.p.listEvents(from, to)).rejects.toBeInstanceOf(CalendarUnavailable);
    expect(r.unauthorised()).toBe(1);
  });
});
