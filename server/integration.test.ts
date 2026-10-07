import { describe, expect, it } from 'vitest';
import { createHttpRepository } from '../src/data/httpRepository.js';
import { createLocalRepository } from '../src/data/localRepository.js';
import { handleData, handleWrite } from './http.js';
import { createSheetsHub, type DataHub } from './hub.js';
import { buildFixtureWorkbook, createFakeSheets } from './sheets/fixture.js';
import { findColumn, parseTable } from './sheets/table.js';

const now = new Date(2026, 9, 7, 14, 0, 0);
const env = { DASHBOARD_ACCESS_KEY: 'k' };

/** The browser repository wired straight to the real handlers, hub and mapping, over an in-memory sheet. */
function stack(key: string | null = 'k') {
  const sheets = createFakeSheets(buildFixtureWorkbook(now));
  const hub: DataHub = createSheetsHub(sheets, { writable: true, ttlMs: 30_000, minForceIntervalMs: 0, now: () => now, log: () => undefined });
  const seen: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    seen.push(`${init?.method ?? 'GET'} ${url}`);
    const req = new Request(`https://app.test${url}`, init);
    return url.startsWith('/api/write') ? handleWrite(req, env, hub) : handleData(req, env, hub);
  }) as unknown as typeof fetch;
  let unauthorised = 0;
  const repo = createHttpRepository({ getKey: () => key, onUnauthorised: () => unauthorised++, extras: createLocalRepository({ demo: false }), fetchImpl, reuseMs: 5_000 });
  return { sheets, hub, repo, seen, unauthorised: () => unauthorised };
}
const taskCell = (sheets: ReturnType<typeof stack>['sheets'], id: string, col: string) => {
  const t = parseTable(sheets.grids.Tasks);
  const row = t.rows.find((r) => r.cells[findColumn(t.headers, ['task_id'])] === id)!;
  return row.cells[findColumn(t.headers, [col])];
};

describe('browser repository ↔ API ↔ hub ↔ sheet', () => {
  it('loads every list from one request', async () => {
    const { repo, seen } = stack();
    const [tasks, projects, ws, decisions] = await Promise.all([repo.listTasks(), repo.listProjects(), repo.listWorkstreams(), repo.listDecisions(), repo.listNotes()]);
    expect(tasks.length).toBeGreaterThan(20);
    expect(projects).toHaveLength(9);
    expect(ws.length).toBeGreaterThan(15);
    expect(decisions).toHaveLength(1);
    expect(seen.filter((s) => s.startsWith('GET'))).toHaveLength(1);
  });
  it('completing a task writes status and completion time into that task’s row, and a Sync_Log entry', async () => {
    const { repo, sheets } = stack();
    await repo.updateTask('TASK-002', { status: 'done', completed_at: '2026-10-07T13:00:00.000Z', is_focus: false, updated_at: 'ignored' });
    expect(taskCell(sheets, 'TASK-002', 'status')).toBe('done');
    expect(taskCell(sheets, 'TASK-002', 'completed_at')).toBe('2026-10-07T13:00:00.000Z');
    expect(taskCell(sheets, 'TASK-003', 'status')).not.toBe('done');
    expect(sheets.grids.Sync_Log).toHaveLength(2);
  });
  it('sends deadlines as local dates, so the sheet keeps a plain date', async () => {
    const { repo, sheets } = stack();
    await repo.updateTask('TASK-002', { deadline: new Date(2026, 9, 9, 23, 59, 59, 999).toISOString() });
    expect(taskCell(sheets, 'TASK-002', 'deadline')).toBe('2026-10-09');
  });
  it('turns a quick capture into an Inbox task with the next TASK id', async () => {
    const { repo, sheets } = stack();
    const before = (await repo.listTasks()).length;
    await repo.createInboxItem({ id: 'x', content: 'Call Marc about Zurich', created_at: now.toISOString(), status: 'inbox' });
    const row = sheets.grids.Tasks.at(-1)!;
    expect(row[0]).toBe(`TASK-0${before + 1}`);
    expect(taskCell(sheets, `TASK-0${before + 1}`, 'status')).toBe('inbox');
    expect(taskCell(sheets, `TASK-0${before + 1}`, 'source')).toBe('capture');
    expect(await repo.listInbox()).toEqual([]);
  });
  it('proposes ids in the sheet’s own style', () => {
    const { repo } = stack();
    expect(repo.nextId!('task', ['TASK-009', 'TASK-010'])).toBe('TASK-011');
    expect(repo.nextId!('workstream', [])).toBe('WS-001');
  });
  it('reports sync status, and refresh tells the providers to reload', async () => {
    const { repo } = stack();
    let reloads = 0;
    repo.sync!.onData(() => reloads++);
    await repo.listTasks();
    expect(repo.sync!.getStatus()).toMatchObject({ stale: false, writable: true });
    expect(repo.sync!.getStatus().syncedAt).toMatch(/^\d{4}-/);
    await repo.sync!.refresh();
    expect(reloads).toBe(1);
  });
  it('keeps showing the last copy, marked stale, when the source is unreachable', async () => {
    const { repo, sheets } = stack();
    const first = await repo.listTasks();
    sheets.readSheets = async () => { throw new Error('down'); };
    await repo.sync!.refresh();
    expect(repo.sync!.getStatus().stale).toBe(true);
    expect(await repo.listTasks()).toEqual(first);
  });
  it('asks for the access key again when the server says no', async () => {
    const { repo, unauthorised } = stack('wrong');
    await expect(repo.listTasks()).rejects.toThrow();
    expect(unauthorised()).toBe(1);
  });
  it('gives the daily question for a date from the Daily_Questions sheet', async () => {
    const { repo } = stack();
    expect(await repo.getDailyQuestion!('2026-10-07')).toBeTruthy();
    expect(await repo.getDailyQuestion!('2001-01-01')).toBeNull();
  });
  it('keeps what the sheet has no place for in this browser, not in the sheet', async () => {
    const { repo, sheets } = stack();
    await repo.createPerson({ id: 'p1', name: 'Zzyzx Person' });
    expect(await repo.listPeople()).toEqual([{ id: 'p1', name: 'Zzyzx Person' }]);
    expect(JSON.stringify(sheets.grids)).not.toContain('Zzyzx');
  });
});
