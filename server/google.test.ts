import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calendarFromEnv, createGoogleCalendarSource, mapGoogleEvent, withCache } from './calendar.js';
import { handleCalendar } from './http.js';
import { createGoogleSheetsClient, createTokenSource, googleConfigFromEnv, ConfigError } from './sheets/client.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const email = 'dashboard@project.iam.gserviceaccount.com';
const cfg = { serviceAccountEmail: email, privateKey };

interface Call { url: string; init?: RequestInit }
/** A pretend Google: answers the token endpoint, and whatever else the test supplies. */
function fakeGoogle(answer: (url: string) => unknown) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = url.startsWith('https://oauth2.googleapis.com/token') ? { access_token: 'tok-1', expires_in: 3600 } : answer(url);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const decode = (part: string) => JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

describe('service account token', () => {
  it('signs a JWT Google can verify, for exactly the scope asked for, and reuses it until it nears expiry', async () => {
    const { calls, fetchImpl } = fakeGoogle(() => ({}));
    const token = createTokenSource(cfg, 'https://www.googleapis.com/auth/calendar.readonly', fetchImpl);
    expect(await token()).toBe('tok-1');
    await token();
    expect(calls).toHaveLength(1);
    const assertion = new URLSearchParams(String(calls[0].init!.body)).get('assertion')!;
    const [h, c, sig] = assertion.split('.');
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(c)).toMatchObject({ iss: email, scope: 'https://www.googleapis.com/auth/calendar.readonly', aud: 'https://oauth2.googleapis.com/token' });
    const ok = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(createPublicKey(publicKey), Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    expect(ok).toBe(true);
  });
  it('reads configuration from environment variables and names only what is missing', () => {
    expect(() => googleConfigFromEnv({})).toThrow(ConfigError);
    try { googleConfigFromEnv({ GOOGLE_SHEETS_ID: 'x' }); } catch (e) { expect((e as ConfigError).missing).toEqual(['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY']); }
    const c = googleConfigFromEnv({ GOOGLE_SHEETS_ID: ' id ', GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: '"line1\\nline2"' });
    expect(c).toMatchObject({ sheetId: 'id', privateKey: 'line1\nline2', write: false });
  });
});

describe('Sheets client request shape', () => {
  const base = { sheetId: 'SHEET', serviceAccountEmail: email, privateKey };
  it('reads all sheets in one batch, unformatted, with the read-only scope by default', async () => {
    const { calls, fetchImpl } = fakeGoogle(() => ({ valueRanges: [{ values: [['a']] }, {}] }));
    const out = await createGoogleSheetsClient({ ...base, write: false }, fetchImpl).readSheets(['Tasks', 'Daily_Questions']);
    expect(out).toEqual({ Tasks: [['a']], Daily_Questions: [] });
    const read = calls.find((c) => c.url.includes('values:batchGet'))!;
    expect(read.url).toContain('/spreadsheets/SHEET/values:batchGet');
    expect(read.url).toContain("ranges='Tasks'");
    expect(read.url).toContain('valueRenderOption=UNFORMATTED_VALUE');
    expect((read.init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    const scope = decode(new URLSearchParams(String(calls[0].init!.body)).get('assertion')!.split('.')[1]).scope;
    expect(scope).toBe('https://www.googleapis.com/auth/spreadsheets.readonly');
  });
  it('refuses to write unless write access was switched on, and then writes RAW to the exact cell', async () => {
    const ro = createGoogleSheetsClient({ ...base, write: false }, fakeGoogle(() => ({})).fetchImpl);
    await expect(ro.updateCells('Tasks', [{ row: 3, column: 3, value: 'done' }])).rejects.toThrow('Writes are disabled');
    const { calls, fetchImpl } = fakeGoogle(() => ({}));
    await createGoogleSheetsClient({ ...base, write: true }, fetchImpl).updateCells('Tasks', [{ row: 3, column: 27, value: 'done' }]);
    const w = calls.find((c) => c.url.includes('values:batchUpdate'))!;
    const body = JSON.parse(String(w.init!.body));
    expect(body.valueInputOption).toBe('RAW');
    expect(body.data).toEqual([{ range: "'Tasks'!AB3", values: [['done']] }]);
    expect(decode(new URLSearchParams(String(calls[0].init!.body)).get('assertion')!.split('.')[1]).scope).toBe('https://www.googleapis.com/auth/spreadsheets');
  });
});

describe('Calendar', () => {
  const rows = [
    { id: 'a', summary: 'Call with investor', location: 'Video call', start: { dateTime: '2026-10-08T15:00:00+01:00' }, end: { dateTime: '2026-10-08T15:45:00+01:00' } },
    { id: 'b', summary: 'Public holiday', start: { date: '2026-10-08' }, end: { date: '2026-10-09' } },
    { id: 'c', status: 'cancelled', summary: 'Cancelled', start: { dateTime: '2026-10-08T10:00:00Z' }, end: { dateTime: '2026-10-08T11:00:00Z' } },
    { id: 'd', summary: 'Declined', attendees: [{ self: true, responseStatus: 'declined' }], start: { dateTime: '2026-10-08T10:00:00Z' }, end: { dateTime: '2026-10-08T11:00:00Z' } },
    { id: 'e', start: { dateTime: '2026-10-08T17:00:00Z' }, end: { dateTime: '2026-10-08T18:00:00Z' } },
    { id: 'f', eventType: 'workingLocation', summary: 'Home', start: { date: '2026-10-08' }, end: { date: '2026-10-09' } },
    { id: 'g', summary: 'No end' },
  ];
  it('maps Google events, skipping cancelled, declined, working-location and unreadable ones', () => {
    const out = rows.map(mapGoogleEvent).filter(Boolean);
    expect(out.map((e) => e!.id)).toEqual(['a', 'b', 'e']);
    expect(out[0]).toMatchObject({ title: 'Call with investor', allDay: false, location: 'Video call', start: '2026-10-08T14:00:00.000Z' });
    expect(out[1]).toMatchObject({ allDay: true });
    expect(out[2]!.title).toBe('Busy'); // shared as free/busy: no title to show
  });
  it('asks Google for the configured calendar and window, with the read-only calendar scope', async () => {
    const { calls, fetchImpl } = fakeGoogle(() => ({ items: rows }));
    const src = createGoogleCalendarSource({ calendarId: 'ana@example.com', ...cfg }, fetchImpl);
    const events = await src.listEvents(new Date('2026-10-08T00:00:00Z'), new Date('2026-10-10T00:00:00Z'));
    expect(events).toHaveLength(3);
    const call = calls.find((c) => c.url.includes('/calendar/v3/'))!;
    expect(call.url).toContain('/calendars/ana%40example.com/events?');
    expect(call.url).toContain('timeMin=2026-10-08T00%3A00%3A00.000Z');
    expect(call.url).toContain('singleEvents=true');
    expect(decode(new URLSearchParams(String(calls[0].init!.body)).get('assertion')!.split('.')[1]).scope).toBe('https://www.googleapis.com/auth/calendar.readonly');
  });
  it('caches for a minute and falls back to the last events when Google fails', async () => {
    let t = 0; let fail = false; let n = 0;
    const cache = withCache({ listEvents: async () => { n++; if (fail) throw new Error('down'); return [{ id: 'x', title: 'X', start: '', end: '', allDay: false }]; } }, 60_000, () => t);
    const a = new Date('2026-10-08T00:00:00Z'), b = new Date('2026-10-09T00:00:00Z');
    await cache.get(a, b); await cache.get(a, b);
    expect(n).toBe(1);
    t = 61_000; fail = true;
    expect((await cache.get(a, b)).stale).toBe(true);
    await expect(cache.get(b, new Date('2026-10-10T00:00:00Z'))).rejects.toThrow('down');
  });
});

describe('/api/calendar', () => {
  const env = { DASHBOARD_ACCESS_KEY: 'k' };
  const soon = () => new Date(Date.now() + 3_600_000);
  const req = (qs: string, key: string | null = 'k') => new Request(`https://x.test/api/calendar?${qs}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
  const window = () => `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(soon().toISOString())}`;
  const ok = { get: async () => ({ events: [{ id: '1', title: 'Dinner', start: '', end: '', allDay: false }], stale: false }) };

  it('needs the access key', async () => {
    expect((await handleCalendar(req(window(), null), env, ok)).status).toBe(401);
    expect((await handleCalendar(req(window(), 'bad'), env, ok)).status).toBe(401);
  });
  it('returns events for a valid window and rejects silly windows', async () => {
    const res = await handleCalendar(req(window()), env, ok);
    expect(res.status).toBe(200);
    expect((await res.json()).events).toHaveLength(1);
    expect((await handleCalendar(req('from=x&to=y'), env, ok)).status).toBe(400);
    expect((await handleCalendar(req(`from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 30 * 86_400_000).toISOString())}`), env, ok)).status).toBe(400);
  });
  it('says "not connected" when the calendar id is missing or the calendar is not shared, and "unavailable" otherwise', async () => {
    expect((await handleCalendar(req(window()), env, { get: async () => { throw new (await import('./sheets/client.js')).ConfigError(['GOOGLE_CALENDAR_ID']); } })).status).toBe(503);
    const notShared = { get: async () => { throw new (await import('./sheets/client.js')).UpstreamError('Google API 404: Not Found', 404); } };
    const res = await handleCalendar(req(window()), env, notShared);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('{"error":"calendar_not_connected"}');
    const down = { get: async () => { throw new (await import('./sheets/client.js')).UpstreamError('Google API 500: oops', 500); } };
    expect((await handleCalendar(req(window()), env, down)).status).toBe(502);
  });
  it('is not configured without GOOGLE_CALENDAR_ID', () => {
    expect(() => calendarFromEnv({ GOOGLE_SHEETS_ID: 'x', GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: privateKey })).toThrow(ConfigError);
  });
});
