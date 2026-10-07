import { describe, expect, it } from 'vitest';
import { createSheetsHub, HubError } from './hub.js';
import { buildFixtureWorkbook, createFakeSheets } from './sheets/fixture.js';
import { SHEETS } from './sheets/schema.js';
import { parseTable, findColumn } from './sheets/table.js';

const now = new Date(2026, 9, 7, 14, 0, 0);
const setup = (writable = true, ttlMs = 30_000) => {
  const sheets = createFakeSheets(buildFixtureWorkbook(now));
  let clock = now;
  const hub = createSheetsHub(sheets, { writable, ttlMs, minForceIntervalMs: 0, now: () => clock, log: () => undefined });
  return { sheets, hub, tick: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
};
const cell = (sheets: ReturnType<typeof setup>['sheets'], sheet: keyof typeof SHEETS, id: string, column: string) => {
  const t = parseTable(sheets.grids[SHEETS[sheet].sheet]);
  const idc = findColumn(t.headers, [SHEETS[sheet].idColumn]);
  const row = t.rows.find((r) => r.cells[idc] === id)!;
  return row.cells[findColumn(t.headers, [column])];
};

describe('reading', () => {
  it('turns rows into typed objects, identified by their ids', async () => {
    const { hub } = setup();
    const tasks = await hub.getTasks();
    expect(tasks.length).toBeGreaterThan(20);
    const brief = tasks.find((t) => t.title === 'Send Watford investor brief')!;
    expect(brief.id).toMatch(/^TASK-\d+$/);
    expect(brief).toMatchObject({ status: 'in_progress', priority: 'high', blocks_others: true, is_focus: false });
    expect(brief.deadline).toMatch(/T23:59:59$/);
    const projects = await hub.getProjects();
    expect(projects).toHaveLength(9);
    expect(projects.find((p) => p.name === 'Restaurant Expansion')).toMatchObject({ category: 'work', status: 'waiting', workstream_kind: 'location' });
  });
  it('relates records by project_id, and keeps extra columns as workstream metadata', async () => {
    const { hub } = setup();
    const projects = await hub.getProjects();
    const ws = await hub.getWorkstreams();
    const pipeline = projects.find((p) => p.name === 'Hotel & Investment Pipeline')!;
    expect(ws.filter((w) => w.project_id === pipeline.id).map((w) => w.name)).toContain('Watford FC');
    expect(ws.find((w) => w.name === 'Ibiza')!.metadata).toMatchObject({ start_date: '2026-10-15', end_date: '2026-10-19' });
  });
  it('finds the daily question for a date and leaves unknown dates empty', async () => {
    const { hub } = setup();
    expect((await hub.getDailyQuestion('2026-10-07'))?.question).toBeTruthy();
    expect(await hub.getDailyQuestion('1999-01-01')).toBeNull();
  });
  it('never invents values for incomplete rows', async () => {
    const { sheets, hub } = setup();
    sheets.grids.Projects.push(['PRJ-099', 'Sparse', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    sheets.grids.Tasks.push(['TASK-999', 'Half-filled task']);
    const p = (await hub.getProjects()).find((x) => x.id === 'PRJ-099')!;
    expect(p).toMatchObject({ name: 'Sparse', summary: null, blocker: null, next_action: null, next_milestone: null, cover_image: null, status: 'active', health: 'on_track' });
    const t = (await hub.getTasks()).find((x) => x.id === 'TASK-999')!;
    expect(t).toMatchObject({ title: 'Half-filled task', status: 'inbox', deadline: null, scheduled_date: null, project_id: null, estimated_duration: null });
    expect(JSON.stringify(t)).not.toMatch(/undefined|NaN/);
  });
  it('reports missing columns instead of failing', async () => {
    const { sheets, hub } = setup();
    sheets.grids.Notes = [['note_id', 'project_id', 'body']];
    const { snapshot } = await hub.getSnapshot({ force: true });
    expect(snapshot.diagnostics.find((d) => d.sheet === 'Notes')!.missingColumns).toEqual(expect.arrayContaining(['workstream_id', 'created_at']));
  });
});

describe('freshness and errors', () => {
  it('reads the sheet at most once per TTL, in one batch', async () => {
    const { sheets, hub, tick } = setup(true, 30_000);
    await hub.getTasks(); await hub.getProjects(); await hub.getNotes();
    expect(sheets.calls.filter((c) => c.startsWith('read'))).toHaveLength(1);
    await hub.getSnapshot({ force: true });
    expect(sheets.calls.filter((c) => c.startsWith('read'))).toHaveLength(2);
    tick(0);
  });
  it('shows the last good copy, marked stale, when Google is unavailable', async () => {
    const { sheets, hub } = setup();
    const first = await hub.getSnapshot();
    expect(first.stale).toBe(false);
    sheets.readSheets = async () => { throw new Error('boom'); };
    const second = await hub.getSnapshot({ force: true });
    expect(second.stale).toBe(true);
    expect(second.snapshot.tasks.length).toBe(first.snapshot.tasks.length);
    expect(second.syncedAt).toBe(first.syncedAt);
  });
  it('throws only when there is nothing to show yet', async () => {
    const sheets = createFakeSheets(buildFixtureWorkbook(now));
    sheets.readSheets = async () => { throw new Error('boom'); };
    const hub = createSheetsHub(sheets, { log: () => undefined });
    await expect(hub.getSnapshot()).rejects.toThrow('boom');
  });
});

describe('writing', () => {
  it('stays read-only unless writes are enabled', async () => {
    const { hub } = setup(false);
    await expect(hub.updateTask('TASK-001', { priority: 'low' })).rejects.toMatchObject({ code: 'read_only' });
  });
  it('updates only the intended cells of the row found by task id, and logs it', async () => {
    const { sheets, hub } = setup();
    const before = JSON.stringify(sheets.grids.Tasks);
    const done = await hub.updateTask('TASK-002', { status: 'done', completed_at: '2026-10-07T13:00:00.000Z', is_focus: false });
    expect(done.status).toBe('done');
    expect(cell(sheets, 'tasks', 'TASK-002', 'status')).toBe('done');
    expect(cell(sheets, 'tasks', 'TASK-002', 'completed_at')).toBe('2026-10-07T13:00:00.000Z');
    expect(cell(sheets, 'tasks', 'TASK-003', 'status')).toBe('planned'); // neighbours untouched
    const changed = JSON.parse(before).flat().length === sheets.grids.Tasks.flat().length;
    expect(changed).toBe(true);
    const log = parseTable(sheets.grids.Sync_Log);
    expect(log.rows).toHaveLength(1);
    const get = (c: string) => log.rows[0].cells[findColumn(log.headers, [c])];
    expect([get('source'), get('action'), get('entity_type'), get('entity_id')]).toEqual(['personal_os', 'update', 'task', 'TASK-002']);
    expect(String(get('summary'))).toMatch(/^Task marked as completed/);
    expect(get('sync_id')).toBe('SYNC-001');
  });
  it('rejects unknown ids and never touches ids or creation time', async () => {
    const { sheets, hub } = setup();
    await expect(hub.updateTask('TASK-404', { priority: 'low' })).rejects.toBeInstanceOf(HubError);
    await hub.updateTask('TASK-001', { id: 'HACK', created_at: '2000-01-01', priority: 'low' } as never);
    expect(cell(sheets, 'tasks', 'TASK-001', 'task_id')).toBe('TASK-001');
    expect(cell(sheets, 'tasks', 'TASK-001', 'priority')).toBe('low');
  });
  it('keeps text as text: a leading "=" is stored for what it is', async () => {
    const { sheets, hub } = setup();
    await hub.updateTask('TASK-001', { title: '=HYPERLINK("http://x")' });
    expect(cell(sheets, 'tasks', 'TASK-001', 'title')).toBe('=HYPERLINK("http://x")');
  });
  it('creates records with the sheet’s own id style, and moves on if the proposed id is taken', async () => {
    const { hub, sheets } = setup();
    const n = (await hub.getTasks()).length;
    const made = await hub.createTask({ ...(await hub.getTasks())[0], id: `TASK-${String(n + 1).padStart(3, '0')}`, title: 'Fresh', status: 'inbox' });
    expect(made.id).toBe(`TASK-${String(n + 1).padStart(3, '0')}`);
    const clash = await hub.createTask({ ...made, title: 'Clash' });
    expect(clash.id).toBe(`TASK-${String(n + 2).padStart(3, '0')}`);
    expect(cell(sheets, 'tasks', clash.id, 'title')).toBe('Clash');
    const weird = await hub.createTask({ ...made, id: 'x"; DROP', title: 'Odd id' });
    expect(weird.id).toMatch(/^TASK-\d+$/);
  });
  it('serialises quick successive writes so ids never collide', async () => {
    const { hub } = setup();
    const base = (await hub.getTasks())[0];
    const made = await Promise.all([1, 2, 3].map((i) => hub.createTask({ ...base, id: '', title: `T${i}` })));
    expect(new Set(made.map((m) => m.id)).size).toBe(3);
  });
  it('deletes by id, not by position', async () => {
    const { hub, sheets } = setup();
    await hub.deleteTask('TASK-002');
    const ids = (await hub.getSnapshot({ force: true })).snapshot.tasks.map((t) => t.id);
    expect(ids).not.toContain('TASK-002');
    expect(ids).toContain('TASK-001');
    expect(ids).toContain('TASK-003');
    expect(sheets.calls).toContain('delete:Tasks');
  });
  it('moves the focus from one task to another in one pass', async () => {
    const { hub, sheets } = setup();
    await hub.setFocus('TASK-001');
    await hub.setFocus('TASK-005');
    expect(cell(sheets, 'tasks', 'TASK-001', 'is_focus')).toBe(false);
    expect(cell(sheets, 'tasks', 'TASK-005', 'is_focus')).toBe(true);
    await hub.setFocus(null);
    expect(cell(sheets, 'tasks', 'TASK-005', 'is_focus')).toBe(false);
  });
  it('writes project, workstream, decision and note records and records the answer to the daily question', async () => {
    const { hub, sheets } = setup();
    await hub.updateProject('PRJ-002', { next_action: 'Call the advisor', last_activity_at: now.toISOString() });
    expect(cell(sheets, 'projects', 'PRJ-002', 'next_action')).toBe('Call the advisor');
    const d = await hub.createDecision({ id: '', project_id: 'PRJ-002', workstream_id: null, date: '2026-10-07', decision: 'Hold Austria', context: 'Focus on Watford', people_ids: [], people_names: ['Marc', 'Sofia'], created_at: now.toISOString() });
    expect(cell(sheets, 'decisions', d.id, 'people_involved')).toBe('Marc, Sofia');
    const note = await hub.createNote({ id: '', project_id: 'PRJ-002', workstream_id: null, body: 'Went well', created_at: now.toISOString() });
    expect(cell(sheets, 'notes', note.id, 'body')).toBe('Went well');
    const ws = await hub.createWorkstream({ id: '', project_id: 'PRJ-002', name: 'Lisbon Hotel', type: 'opportunity', status: 'active', health: 'on_track', summary: null, next_action: null, blocker: null, next_milestone: null, metadata: {}, created_at: now.toISOString(), updated_at: now.toISOString(), last_activity_at: now.toISOString() });
    expect(cell(sheets, 'workstreams', ws.id, 'name')).toBe('Lisbon Hotel');
    await hub.saveDailyAnswer('2026-10-07', 'q', 'Send the brief');
    expect(cell(sheets, 'dailyQuestions', 'Q-001', 'answer')).toBe('Send the brief');
  });
  it('says so plainly when the sheet has no place for an answer', async () => {
    const { hub, sheets } = setup();
    sheets.grids.Daily_Questions = [['question_id', 'date', 'question'], ['Q-001', '2026-10-07', 'Why?']];
    await expect(hub.saveDailyAnswer('2026-10-07', 'Why?', 'Because')).rejects.toMatchObject({ code: 'schema' });
  });
});
