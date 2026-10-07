import { describe, expect, it } from 'vitest';
import { handleData, handleWrite } from './http.js';
import { createSheetsHub } from './hub.js';
import { buildFixtureWorkbook, createFakeSheets } from './sheets/fixture.js';

const now = new Date(2026, 9, 7, 14, 0, 0);
const env = { DASHBOARD_ACCESS_KEY: 'correct horse battery staple', GOOGLE_PRIVATE_KEY: 'fake-private-key-material-SECRET' };
const hubWith = (writable = true) => createSheetsHub(createFakeSheets(buildFixtureWorkbook(now)), { writable, log: () => undefined, minForceIntervalMs: 0 });
const get = (key?: string, qs = '') => new Request(`https://x.test/api/data${qs}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
const post = (body: unknown, key = env.DASHBOARD_ACCESS_KEY) =>
  new Request('https://x.test/api/write', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('access', () => {
  it('refuses everyone when no access key is configured, rather than opening up', async () => {
    expect((await handleData(get('anything'), {}, hubWith())).status).toBe(503);
  });
  it('refuses missing and wrong keys', async () => {
    expect((await handleData(get(), env, hubWith())).status).toBe(401);
    expect((await handleData(get('nope'), env, hubWith())).status).toBe(401);
    expect((await handleWrite(post({ op: 'setFocus', id: null }, 'nope'), env, hubWith())).status).toBe(401);
  });
  it('answers the right key with the data, privately, and never leaks configuration', async () => {
    const res = await handleData(get(env.DASHBOARD_ACCESS_KEY), env, hubWith());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const text = await res.text();
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain(env.DASHBOARD_ACCESS_KEY);
    const body = JSON.parse(text);
    expect(body).toMatchObject({ stale: false, writable: true });
    expect(body.data.tasks.length).toBeGreaterThan(0);
    expect(body.syncedAt).toMatch(/^\d{4}-/);
  });
});

describe('errors stay calm', () => {
  it('reports an unreachable sheet as a generic upstream error with no technical detail', async () => {
    const sheets = createFakeSheets(buildFixtureWorkbook(now));
    sheets.readSheets = async () => { throw new Error('Google API 403: service account x@y.iam secret details'); };
    const res = await handleData(get(env.DASHBOARD_ACCESS_KEY), env, createSheetsHub(sheets, { log: () => undefined }));
    expect(res.status).toBe(502);
    expect(await res.text()).toBe('{"error":"upstream"}');
  });
  it('serves the last good copy, flagged stale, once it has one', async () => {
    const sheets = createFakeSheets(buildFixtureWorkbook(now));
    const hub = createSheetsHub(sheets, { log: () => undefined, minForceIntervalMs: 0 });
    await handleData(get(env.DASHBOARD_ACCESS_KEY), env, hub);
    sheets.readSheets = async () => { throw new Error('down'); };
    const res = await handleData(get(env.DASHBOARD_ACCESS_KEY, '?refresh=1'), env, hub);
    expect(res.status).toBe(200);
    expect((await res.json()).stale).toBe(true);
  });
});

describe('writes', () => {
  it('applies a known operation by id', async () => {
    const hub = hubWith();
    const res = await handleWrite(post({ op: 'updateTask', id: 'TASK-002', patch: { priority: 'low' } }), env, hub);
    expect(res.status).toBe(200);
    expect((await res.json()).record.priority).toBe('low');
  });
  it('maps problems to clear statuses', async () => {
    expect((await handleWrite(post({ op: 'updateTask', id: 'TASK-404', patch: {} }), env, hubWith())).status).toBe(404);
    expect((await handleWrite(post({ op: 'updateTask', id: 'TASK-002', patch: { priority: 'low' } }), env, hubWith(false))).status).toBe(403);
    expect((await handleWrite(post({ op: 'drop tables' }), env, hubWith())).status).toBe(400);
    expect((await handleWrite(post('not json'), env, hubWith())).status).toBe(400);
    expect((await handleWrite(post({ op: 'updateTask', id: 5, patch: {} }), env, hubWith())).status).toBe(400);
  });
  it('rejects oversized bodies', async () => {
    const res = await handleWrite(post({ op: 'createNote', note: { body: 'x'.repeat(70_000) } }), env, hubWith());
    expect(res.status).toBe(400);
  });
});
