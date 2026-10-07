import type {
  DailyAnswer, Health, Priority, Project, ProjectCategory, ProjectDecision, ProjectNote, ProjectStatus, Task, TaskStatus, Workstream, WorkstreamKind,
} from '../../src/domain/types.js';
import { findColumn, parseBool, parseDay, parseDeadline, parseInt0, parseString, parseTimestamp, slug, toCell, type Cell, type Table } from './table.js';

/**
 * The Data Hub's sheets, described once. Sheet and column names are the contract with the
 * spreadsheet: they are matched by name (never by position) and are never renamed here.
 */
export type Kind = 'str' | 'int' | 'bool' | 'date' | 'datetime' | 'deadline';

export interface FieldSpec {
  /** Key in the application object. */
  key: string;
  /** Column header in the sheet (defaults to `key`). */
  column?: string;
  aliases?: string[];
  kind: Kind;
}

export interface EntitySpec {
  sheet: string;
  entity: string;
  /** Header of the stable identifier column, and other names it may have. */
  idColumn: string;
  idAliases: string[];
  /** Used only when a new id has to be made and no existing id shows the convention. */
  idPrefix: string;
  fields: FieldSpec[];
}

const f = (key: string, kind: Kind = 'str', aliases: string[] = [], column?: string): FieldSpec => ({ key, kind, aliases, column });

export const SHEETS = {
  tasks: {
    sheet: 'Tasks', entity: 'task', idColumn: 'task_id', idAliases: ['id'], idPrefix: 'TASK-',
    fields: [
      f('title'), f('description'), f('status'), f('priority'),
      f('deadline', 'deadline', ['due_date', 'due']), f('scheduled_date', 'date', ['scheduled', 'planned_date']),
      f('estimated_duration', 'int', ['duration', 'estimated_minutes']),
      f('project_id'), f('workstream_id'), f('assigned_person_id'),
      f('created_at', 'datetime'), f('updated_at', 'datetime'), f('last_activity_at', 'datetime'), f('completed_at', 'datetime'),
      f('impact_score', 'int'), f('blocks_others', 'bool'), f('blocks_note'), f('is_focus', 'bool'),
      f('source'), f('notes'), f('delegated_to'),
      f('waiting_since', 'datetime'), f('backlog_since', 'datetime'), f('reschedule_count', 'int'), f('last_reviewed_at', 'datetime'),
    ],
  },
  projects: {
    sheet: 'Projects', entity: 'project', idColumn: 'project_id', idAliases: ['id'], idPrefix: 'PROJECT-',
    fields: [
      f('name'), f('category'), f('summary'), f('objective'), f('status_note', 'str', ['current_status']),
      f('status'), f('health'), f('next_action'), f('blocker'), f('next_milestone'), f('next_milestone_date', 'date'),
      f('cover_image'), f('workstream_kind', 'str', ['kind', 'child_type']),
      f('created_at', 'datetime'), f('updated_at', 'datetime'), f('last_activity_at', 'datetime'),
    ],
  },
  workstreams: {
    sheet: 'Workstreams', entity: 'workstream', idColumn: 'workstream_id', idAliases: ['id'], idPrefix: 'WS-',
    fields: [
      f('project_id'), f('name'), f('type'), f('status'), f('health'), f('summary'), f('next_action'), f('blocker'), f('next_milestone'),
      f('created_at', 'datetime'), f('updated_at', 'datetime'), f('last_activity_at', 'datetime'),
    ],
  },
  decisions: {
    sheet: 'Decisions', entity: 'decision', idColumn: 'decision_id', idAliases: ['id'], idPrefix: 'DEC-',
    fields: [
      f('project_id'), f('workstream_id'), f('date', 'date', ['decided_on']), f('decision'),
      f('context', 'str', ['reason', 'reason_context', 'rationale']), f('people_involved', 'str', ['people', 'people_names']),
      f('created_at', 'datetime'),
    ],
  },
  notes: {
    sheet: 'Notes', entity: 'note', idColumn: 'note_id', idAliases: ['id'], idPrefix: 'NOTE-',
    fields: [f('project_id'), f('workstream_id'), f('body', 'str', ['note', 'content', 'text']), f('created_at', 'datetime')],
  },
  dailyQuestions: {
    sheet: 'Daily_Questions', entity: 'daily_question', idColumn: 'question_id', idAliases: ['id'], idPrefix: 'Q-',
    fields: [f('date', 'date'), f('question'), f('answer', 'str', ['response']), f('answered_at', 'datetime')],
  },
  syncLog: {
    sheet: 'Sync_Log', entity: 'sync', idColumn: 'sync_id', idAliases: ['id'], idPrefix: 'SYNC-',
    fields: [f('timestamp', 'datetime', ['created_at', 'time']), f('source'), f('action'), f('entity_type'), f('entity_id'), f('summary')],
  },
} satisfies Record<string, EntitySpec>;

export type SheetKey = keyof typeof SHEETS;

/* ---------- reading ---------- */

export interface RawRecord {
  id: string;
  rowNumber: number;
  /** Parsed values by application key. Missing columns and blank cells are null. */
  v: Record<string, unknown>;
  /** Columns the spec does not know about: kept, so nothing the user adds is lost. */
  extras: Record<string, string | number | boolean>;
}

export interface Diagnostics {
  sheet: string;
  /** Expected columns not found in the header row. */
  missingColumns: string[];
  /** Header names nothing maps to (kept as extras). */
  unmappedColumns: string[];
  idColumnFound: boolean;
  rowsRead: number;
  /** Rows skipped because they had no id. */
  rowsWithoutId: number;
}

const parseCell = (kind: Kind, c: Cell): unknown => {
  switch (kind) {
    case 'int': return parseInt0(c);
    case 'bool': return parseBool(c);
    case 'date': return parseDay(c);
    case 'datetime': return parseTimestamp(c);
    case 'deadline': return parseDeadline(c);
    default: return parseString(c);
  }
};

const columnNames = (fd: FieldSpec) => [fd.column ?? fd.key, fd.key, ...(fd.aliases ?? [])];

export function readRecords(table: Table, spec: EntitySpec): { records: RawRecord[]; diagnostics: Diagnostics } {
  const idCol = findColumn(table.headers, [spec.idColumn, ...spec.idAliases]);
  const cols = spec.fields.map((fd) => ({ fd, index: findColumn(table.headers, columnNames(fd)) }));
  const used = new Set<number>([idCol, ...cols.map((c) => c.index)].filter((i) => i >= 0));
  const records: RawRecord[] = [];
  let rowsWithoutId = 0;

  for (const row of table.rows) {
    const id = idCol >= 0 ? parseString(row.cells[idCol]) : null;
    if (!id) { rowsWithoutId++; continue; }
    const v: Record<string, unknown> = {};
    for (const { fd, index } of cols) v[fd.key] = index >= 0 ? parseCell(fd.kind, row.cells[index]) : null;
    const extras: RawRecord['extras'] = {};
    table.headers.forEach((h, i) => {
      const c = row.cells[i];
      if (h && !used.has(i) && c !== '' && c !== null && c !== undefined) extras[h] = c;
    });
    records.push({ id, rowNumber: row.rowNumber, v, extras });
  }

  return {
    records,
    diagnostics: {
      sheet: spec.sheet,
      missingColumns: [idCol < 0 ? spec.idColumn : '', ...cols.filter((c) => c.index < 0).map((c) => c.fd.column ?? c.fd.key)].filter(Boolean),
      unmappedColumns: table.headers.filter((h, i) => h && !used.has(i)),
      idColumnFound: idCol >= 0,
      rowsRead: table.rows.length,
      rowsWithoutId,
    },
  };
}

/* ---------- writing ---------- */

export interface CellWrite {
  column: number;
  value: Cell;
}

/** Cells to write for the given application values; keys whose column is absent are returned in `skipped`. */
export function toCells(table: Table, spec: EntitySpec, values: Record<string, unknown>): { cells: CellWrite[]; skipped: string[] } {
  const cells: CellWrite[] = [];
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const fd = spec.fields.find((x) => x.key === key);
    const index = fd ? findColumn(table.headers, columnNames(fd)) : -1;
    if (!fd || index < 0) { skipped.push(key); continue; }
    cells.push({ column: index, value: toCell(fd.kind, value) });
  }
  return { cells, skipped };
}

/** A full row in header order (for append). Unknown columns stay blank. */
export function toRow(table: Table, spec: EntitySpec, id: string, values: Record<string, unknown>): { row: Cell[]; skipped: string[] } {
  const row: Cell[] = table.headers.map(() => '');
  const idCol = findColumn(table.headers, [spec.idColumn, ...spec.idAliases]);
  if (idCol >= 0) row[idCol] = id;
  const { cells, skipped } = toCells(table, spec, values);
  for (const c of cells) row[c.column] = c.value;
  return { row, skipped };
}

export { nextId } from '../../src/domain/ids.js';

/* ---------- enum normalisation ---------- */

function pick<T extends string>(value: unknown, allowed: readonly T[], synonyms: Record<string, T>, fallback: T): { value: T; known: boolean } {
  const s = slug(value);
  if ((allowed as readonly string[]).includes(s)) return { value: s as T, known: true };
  if (synonyms[s]) return { value: synonyms[s], known: true };
  return { value: fallback, known: s === '' };
}

const TASK_STATUS = ['inbox', 'backlog', 'planned', 'in_progress', 'waiting', 'done'] as const;
const PROJECT_STATUS = ['active', 'waiting', 'on_hold', 'completed'] as const;
const HEALTH = ['on_track', 'needs_attention', 'blocked'] as const;
const CATEGORY = ['work', 'business', 'personal'] as const;
const PRIORITY = ['high', 'medium', 'low'] as const;
const KIND = ['workstream', 'opportunity', 'location', 'trip'] as const;

export const taskStatus = (v: unknown) => pick<TaskStatus>(v, TASK_STATUS, { todo: 'planned', to_do: 'planned', doing: 'in_progress', progress: 'in_progress', blocked: 'waiting', completed: 'done', complete: 'done', closed: 'done' }, 'inbox');
export const projectStatus = (v: unknown) => pick<ProjectStatus>(v, PROJECT_STATUS, { paused: 'on_hold', hold: 'on_hold', done: 'completed', complete: 'completed', in_progress: 'active', live: 'active' }, 'active');
export const health = (v: unknown) => pick<Health>(v, HEALTH, { green: 'on_track', ok: 'on_track', amber: 'needs_attention', attention: 'needs_attention', at_risk: 'needs_attention', red: 'blocked' }, 'on_track');
export const category = (v: unknown) => pick<ProjectCategory>(v, CATEGORY, { professional: 'work' }, 'work');
export const priority = (v: unknown) => pick<Priority>(v, PRIORITY, { urgent: 'high', critical: 'high', normal: 'medium', med: 'medium' }, 'medium');
export const kind = (v: unknown) => pick<WorkstreamKind>(v, KIND, { opportunities: 'opportunity', locations: 'location', trips: 'trip', market: 'location' }, 'workstream');

/* ---------- raw record → application object ---------- */

const s = (x: unknown) => (typeof x === 'string' ? x : null);
const n = (x: unknown) => (typeof x === 'number' ? x : null);
const b = (x: unknown) => (typeof x === 'boolean' ? x : null);

export function buildTask(r: RawRecord, now: Date): Task {
  const iso = now.toISOString();
  const status = taskStatus(r.v.status).value;
  const created = s(r.v.created_at) ?? s(r.v.updated_at) ?? iso;
  const updated = s(r.v.updated_at) ?? created;
  return {
    id: r.id,
    title: s(r.v.title) ?? 'Untitled task',
    description: s(r.v.description),
    status,
    priority: priority(r.v.priority).value,
    deadline: s(r.v.deadline),
    scheduled_date: s(r.v.scheduled_date),
    estimated_duration: n(r.v.estimated_duration),
    project_id: s(r.v.project_id),
    workstream_id: s(r.v.workstream_id),
    created_at: created,
    updated_at: updated,
    last_activity_at: s(r.v.last_activity_at) ?? updated,
    completed_at: s(r.v.completed_at) ?? (status === 'done' ? updated : null),
    impact_score: Math.min(10, Math.max(1, n(r.v.impact_score) ?? 5)),
    blocks_others: b(r.v.blocks_others) ?? false,
    blocks_note: s(r.v.blocks_note),
    is_focus: (b(r.v.is_focus) ?? false) && status !== 'done',
    source: s(r.v.source) ?? 'data_hub',
    notes: s(r.v.notes),
    assigned_person_id: s(r.v.assigned_person_id),
    delegated_to: s(r.v.delegated_to),
    waiting_since: s(r.v.waiting_since),
    backlog_since: s(r.v.backlog_since),
    reschedule_count: Math.max(0, n(r.v.reschedule_count) ?? 0),
    last_reviewed_at: s(r.v.last_reviewed_at),
  };
}

export function buildProject(r: RawRecord, now: Date): Project {
  const iso = now.toISOString();
  const created = s(r.v.created_at) ?? s(r.v.last_activity_at) ?? iso;
  return {
    id: r.id,
    name: s(r.v.name) ?? r.id,
    category: category(r.v.category).value,
    summary: s(r.v.summary),
    objective: s(r.v.objective),
    status_note: s(r.v.status_note),
    status: projectStatus(r.v.status).value,
    health: health(r.v.health).value,
    next_action: s(r.v.next_action),
    blocker: s(r.v.blocker),
    next_milestone: s(r.v.next_milestone),
    next_milestone_date: s(r.v.next_milestone_date),
    cover_image: s(r.v.cover_image),
    workstream_kind: kind(r.v.workstream_kind).value,
    goal_id: null,
    created_at: created,
    updated_at: s(r.v.updated_at) ?? created,
    last_activity_at: s(r.v.last_activity_at) ?? s(r.v.updated_at) ?? created,
  };
}

export function buildWorkstream(r: RawRecord, now: Date): Workstream {
  const created = s(r.v.created_at) ?? s(r.v.last_activity_at) ?? now.toISOString();
  return {
    id: r.id,
    project_id: s(r.v.project_id) ?? '',
    name: s(r.v.name) ?? r.id,
    type: kind(r.v.type).value,
    status: projectStatus(r.v.status).value,
    health: health(r.v.health).value,
    summary: s(r.v.summary),
    next_action: s(r.v.next_action),
    blocker: s(r.v.blocker),
    next_milestone: s(r.v.next_milestone),
    // Anything else in the sheet (asking price, landlord, start_date…) rides along untouched.
    metadata: { ...r.extras },
    created_at: created,
    updated_at: s(r.v.updated_at) ?? created,
    last_activity_at: s(r.v.last_activity_at) ?? s(r.v.updated_at) ?? created,
  };
}

const splitNames = (x: unknown): string[] => (typeof x === 'string' ? x.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean) : []);

export function buildDecision(r: RawRecord, now: Date): ProjectDecision {
  const day = s(r.v.date);
  return {
    id: r.id,
    project_id: s(r.v.project_id) ?? '',
    workstream_id: s(r.v.workstream_id),
    date: day ?? (s(r.v.created_at) ?? now.toISOString()).slice(0, 10),
    decision: s(r.v.decision) ?? '',
    context: s(r.v.context),
    people_ids: [],
    people_names: splitNames(r.v.people_involved),
    created_at: s(r.v.created_at) ?? (day ? `${day}T12:00:00.000Z` : now.toISOString()),
  };
}

export function buildNote(r: RawRecord, now: Date): ProjectNote {
  return {
    id: r.id,
    project_id: s(r.v.project_id) ?? '',
    workstream_id: s(r.v.workstream_id),
    body: s(r.v.body) ?? '',
    created_at: s(r.v.created_at) ?? now.toISOString(),
  };
}

export interface DailyQuestionRow {
  id: string;
  date: string | null;
  question: string;
  answer: string | null;
}

export function buildDailyQuestion(r: RawRecord): DailyQuestionRow {
  return { id: r.id, date: s(r.v.date), question: s(r.v.question) ?? '', answer: s(r.v.answer) };
}

export const toDailyAnswer = (q: DailyQuestionRow): DailyAnswer | null => (q.date && q.answer ? { date: q.date, question: q.question, answer: q.answer } : null);
