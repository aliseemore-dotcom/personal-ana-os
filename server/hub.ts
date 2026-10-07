import type {
  Project, ProjectDecision, ProjectNote, ProjectPatch, Task, TaskPatch, Workstream, WorkstreamPatch,
} from '../src/domain/types.js';
import type { SheetsClient } from './sheets/client.js';
import {
  buildDailyQuestion, buildDecision, buildNote, buildProject, buildTask, buildWorkstream, nextId, readRecords, SHEETS, toCells, toRow,
  type DailyQuestionRow, type Diagnostics, type EntitySpec, type RawRecord, type SheetKey,
} from './sheets/schema.js';
import { parseTable, type Cell, type Table } from './sheets/table.js';

/**
 * The server-side data service. The UI depends on this shape (via /api), never on Google Sheets.
 * A Supabase implementation can replace `createSheetsHub` without touching TODAY, TASKS or PROJECTS.
 */
export interface Snapshot {
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  decisions: ProjectDecision[];
  notes: ProjectNote[];
  dailyQuestions: DailyQuestionRow[];
  diagnostics: Diagnostics[];
}

export interface SnapshotResult {
  snapshot: Snapshot;
  syncedAt: string;
  /** True when the sheet could not be reached and this is the last good copy. */
  stale: boolean;
}

export interface DataHub {
  readonly writable: boolean;
  getSnapshot(opts?: { force?: boolean }): Promise<SnapshotResult>;
  getTasks(): Promise<Task[]>;
  getProjects(): Promise<Project[]>;
  getWorkstreams(): Promise<Workstream[]>;
  getDecisions(): Promise<ProjectDecision[]>;
  getNotes(): Promise<ProjectNote[]>;
  getDailyQuestion(date: string): Promise<DailyQuestionRow | null>;

  createTask(task: Task): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  setFocus(id: string | null): Promise<void>;
  updateProject(id: string, patch: ProjectPatch): Promise<Project>;
  createWorkstream(w: Workstream): Promise<Workstream>;
  updateWorkstream(id: string, patch: WorkstreamPatch): Promise<Workstream>;
  createDecision(d: ProjectDecision): Promise<ProjectDecision>;
  createNote(n: ProjectNote): Promise<ProjectNote>;
  saveDailyAnswer(date: string, question: string, answer: string): Promise<void>;
}

export type HubErrorCode = 'not_found' | 'read_only' | 'invalid' | 'schema';
export class HubError extends Error {
  constructor(public code: HubErrorCode, message: string) {
    super(message);
  }
}

export interface HubOptions {
  /** How long a read stays fresh. Sheets is not polled more often than this. */
  ttlMs?: number;
  /** A forced refresh is honoured at most this often, so a stuck button cannot hammer Google. */
  minForceIntervalMs?: number;
  writable?: boolean;
  now?: () => Date;
  log?: (message: string, detail?: unknown) => void;
}

const SOURCE = 'personal_os';
const NEVER = new Set(['id', 'created_at']);

export function createSheetsHub(client: SheetsClient, opts: HubOptions = {}): DataHub {
  const ttl = opts.ttlMs ?? 30_000;
  const minForce = opts.minForceIntervalMs ?? 10_000;
  const writable = opts.writable ?? false;
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? ((m, d) => console.error(m, d ?? ''));

  let cached: { result: SnapshotResult; fetchedAt: number } | null = null;
  let inflight: Promise<SnapshotResult> | null = null;
  let lastForce = 0;
  let writeChain: Promise<unknown> = Promise.resolve();

  /* ---------- reading ---------- */

  async function fetchSnapshot(): Promise<SnapshotResult> {
    const keys: SheetKey[] = ['tasks', 'projects', 'workstreams', 'decisions', 'notes', 'dailyQuestions'];
    const grids = await client.readSheets(keys.map((k) => SHEETS[k].sheet));
    const at = now();
    const read = (k: SheetKey) => readRecords(parseTable(grids[SHEETS[k].sheet]), SHEETS[k]);
    const [tasks, projects, workstreams, decisions, notes, dq] = keys.map(read);
    const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map((i) => [i.id, i])).values()];

    const snapshot: Snapshot = {
      tasks: unique(tasks.records.map((r) => buildTask(r, at))),
      projects: unique(projects.records.map((r) => buildProject(r, at))),
      workstreams: unique(workstreams.records.map((r) => buildWorkstream(r, at))),
      decisions: unique(decisions.records.map((r) => buildDecision(r, at))).filter((d) => d.decision),
      notes: unique(notes.records.map((r) => buildNote(r, at))).filter((n) => n.body),
      dailyQuestions: dq.records.map(buildDailyQuestion),
      diagnostics: [tasks, projects, workstreams, decisions, notes, dq].map((x) => x.diagnostics),
    };
    for (const d of snapshot.diagnostics) {
      if (d.missingColumns.length || d.rowsWithoutId) log(`[data hub] ${d.sheet}: missing columns [${d.missingColumns.join(', ')}], rows without id: ${d.rowsWithoutId}`);
    }
    return { snapshot, syncedAt: at.toISOString(), stale: false };
  }

  async function getSnapshot({ force = false } = {}): Promise<SnapshotResult> {
    const t = Date.now();
    const honourForce = force && t - lastForce >= minForce;
    if (honourForce) lastForce = t;
    if (cached && !honourForce && t - cached.fetchedAt < ttl) return cached.result;
    if (!inflight) {
      inflight = fetchSnapshot()
        .then((result) => {
          cached = { result, fetchedAt: Date.now() };
          return result;
        })
        .finally(() => {
          inflight = null;
        });
    }
    try {
      return await inflight;
    } catch (e) {
      log('[data hub] could not read the sheet', (e as Error).message);
      if (cached) return { ...cached.result, stale: true };
      throw e;
    }
  }

  const invalidate = () => {
    if (cached) cached.fetchedAt = 0;
  };

  /* ---------- writing ---------- */

  /** One write at a time, so two quick actions never pick the same new id or row. */
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = writeChain.then(fn, fn);
    writeChain = run.catch(() => undefined);
    return run;
  }

  function guard() {
    if (!writable) throw new HubError('read_only', 'The data hub is connected read-only');
  }

  async function load(key: SheetKey): Promise<{ spec: EntitySpec; table: Table; records: RawRecord[] }> {
    const spec: EntitySpec = SHEETS[key];
    const grids = await client.readSheets([spec.sheet]);
    const table = parseTable(grids[spec.sheet]);
    const { records, diagnostics } = readRecords(table, spec);
    if (!diagnostics.idColumnFound) throw new HubError('schema', `${spec.sheet} has no ${spec.idColumn} column`);
    return { spec, table, records };
  }

  async function logSync(action: string, entityType: string, entityId: string, summary: string) {
    try {
      const { spec, table, records } = await load('syncLog');
      const id = nextId(records.map((r) => r.id), spec.idPrefix);
      const { row } = toRow(table, spec, id, { timestamp: now().toISOString(), source: SOURCE, action, entity_type: entityType, entity_id: entityId, summary });
      await client.appendRow(spec.sheet, row);
    } catch (e) {
      // A missing log row must not undo or hide a successful change.
      log('[data hub] could not write Sync_Log', (e as Error).message);
    }
  }

  const clean = (patch: Record<string, unknown>) => Object.fromEntries(Object.entries(patch).filter(([k, v]) => !NEVER.has(k) && v !== undefined));
  const short = (s: string) => (s.length > 70 ? `${s.slice(0, 67)}…` : s);

  async function update<T>(key: SheetKey, id: string, patch: Record<string, unknown>, build: (r: RawRecord, at: Date) => T, summary: (before: T, patch: Record<string, unknown>) => string, action = 'update'): Promise<T> {
    guard();
    return serial(async () => {
      const { spec, table, records } = await load(key);
      const rec = records.find((r) => r.id === id);
      if (!rec) throw new HubError('not_found', `${spec.sheet}: no record ${id}`);
      const values = clean(patch);
      const { cells, skipped } = toCells(table, spec, values);
      if (skipped.length) log(`[data hub] ${spec.sheet}: no column for [${skipped.join(', ')}], not written`);
      await client.updateCells(spec.sheet, cells.map((c) => ({ row: rec.rowNumber, column: c.column, value: c.value })));
      invalidate();
      const before = build(rec, now());
      await logSync(action, spec.entity, id, summary(before, values));
      return { ...before, ...values } as T;
    });
  }

  async function create<T extends { id: string }>(key: SheetKey, proposed: T, values: Record<string, unknown>, build: (r: RawRecord, at: Date) => T, summary: (made: T) => string): Promise<T> {
    guard();
    return serial(async () => {
      const { spec, table, records } = await load(key);
      const existing = records.map((r) => r.id);
      // Keep the id the browser proposed when it is free; otherwise take the next one in the sheet's own style.
      const id = proposed.id && !existing.includes(proposed.id) && /^[\w.-]{1,40}$/.test(proposed.id) ? proposed.id : nextId(existing, spec.idPrefix);
      const { row, skipped } = toRow(table, spec, id, clean(values));
      if (skipped.length) log(`[data hub] ${spec.sheet}: no column for [${skipped.join(', ')}], not written`);
      await client.appendRow(spec.sheet, row);
      invalidate();
      const made = { ...build({ id, rowNumber: 0, v: {}, extras: {} }, now()), ...proposed, id } as T;
      await logSync('create', spec.entity, id, summary(made));
      return made;
    });
  }

  const taskSummary = (t: Task, p: Record<string, unknown>) => {
    if (p.status === 'done') return `Task marked as completed: ${short(t.title)}`;
    if (p.status && p.status !== t.status) return `Task moved to ${String(p.status).replace('_', ' ')}: ${short(t.title)}`;
    if ('scheduled_date' in p && p.scheduled_date) return `Task scheduled for ${String(p.scheduled_date)}: ${short(t.title)}`;
    const keys = Object.keys(p).filter((k) => !['last_activity_at', 'updated_at'].includes(k));
    return `Task updated (${keys.join(', ') || 'activity'}): ${short(t.title)}`;
  };

  /* ---------- public interface ---------- */

  const part = async <K extends keyof Snapshot>(k: K): Promise<Snapshot[K]> => (await getSnapshot()).snapshot[k];

  return {
    writable,
    getSnapshot,
    getTasks: () => part('tasks'),
    getProjects: () => part('projects'),
    getWorkstreams: () => part('workstreams'),
    getDecisions: () => part('decisions'),
    getNotes: () => part('notes'),
    async getDailyQuestion(date) {
      const rows = (await part('dailyQuestions')).filter((q) => q.date === date && q.question);
      return rows[0] ?? null;
    },

    createTask: (task) => create('tasks', task, task as unknown as Record<string, unknown>, buildTask, (t) => `Task created: ${short(t.title)}`),
    updateTask: (id, patch) => update('tasks', id, patch, buildTask, taskSummary),

    async deleteTask(id) {
      guard();
      await serial(async () => {
        const { spec, records } = await load('tasks');
        const rec = records.find((r) => r.id === id);
        if (!rec) throw new HubError('not_found', `${spec.sheet}: no record ${id}`);
        const title = buildTask(rec, now()).title;
        await client.deleteRow(spec.sheet, rec.rowNumber);
        invalidate();
        await logSync('delete', 'task', id, `Task deleted: ${short(title)}`);
      });
    },

    async setFocus(id) {
      guard();
      await serial(async () => {
        const { spec, table, records } = await load('tasks');
        if (id && !records.some((r) => r.id === id)) throw new HubError('not_found', `${spec.sheet}: no record ${id}`);
        const writes: { row: number; column: number; value: Cell }[] = [];
        for (const r of records) {
          const should = r.id === id;
          if ((r.v.is_focus === true) === should) continue;
          const { cells } = toCells(table, spec, { is_focus: should });
          for (const c of cells) writes.push({ row: r.rowNumber, column: c.column, value: c.value });
        }
        if (writes.length === 0 && id === null) return;
        await client.updateCells(spec.sheet, writes);
        invalidate();
        await logSync('update', 'task', id ?? '-', id ? `Focus of the day set: ${short(buildTask(records.find((r) => r.id === id)!, now()).title)}` : 'Focus of the day cleared');
      });
    },

    updateProject: (id, patch) => update('projects', id, patch, buildProject, (p, v) => `Project updated (${Object.keys(v).filter((k) => k !== 'last_activity_at').join(', ') || 'activity'}): ${short(p.name)}`),
    createWorkstream: (w) => create('workstreams', w, w as unknown as Record<string, unknown>, buildWorkstream, (x) => `Workstream created: ${short(x.name)}`),
    updateWorkstream: (id, patch) => update('workstreams', id, patch, buildWorkstream, (w, v) => `Workstream updated (${Object.keys(v).filter((k) => k !== 'last_activity_at').join(', ') || 'activity'}): ${short(w.name)}`),
    createDecision: (d) =>
      create('decisions', d, { ...d, people_involved: (d.people_names ?? []).join(', ') }, buildDecision, (x) => `Decision recorded: ${short(x.decision)}`),
    createNote: (n) => create('notes', n, n as unknown as Record<string, unknown>, buildNote, (x) => `Note added: ${short(x.body)}`),

    async saveDailyAnswer(date, question, answer) {
      guard();
      await serial(async () => {
        const { spec, table, records } = await load('dailyQuestions');
        const rec = records.find((r) => r.v.date === date);
        const answeredAt = now().toISOString();
        if (rec) {
          const { cells, skipped } = toCells(table, spec, { answer, answered_at: answeredAt });
          if (skipped.includes('answer')) throw new HubError('schema', 'Daily_Questions has no answer column');
          await client.updateCells(spec.sheet, cells.map((c) => ({ row: rec.rowNumber, column: c.column, value: c.value })));
          invalidate();
          await logSync('update', 'daily_question', rec.id, `Daily question answered (${date})`);
        } else {
          const id = nextId(records.map((r) => r.id), spec.idPrefix);
          const { row, skipped } = toRow(table, spec, id, { date, question, answer, answered_at: answeredAt });
          if (skipped.includes('answer')) throw new HubError('schema', 'Daily_Questions has no answer column');
          await client.appendRow(spec.sheet, row);
          invalidate();
          await logSync('create', 'daily_question', id, `Daily question answered (${date})`);
        }
      });
    },
  };
}
