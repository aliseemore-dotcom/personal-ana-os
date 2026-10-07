import { buildSeed } from '../../src/data/seed.js';
import { DAILY_QUESTIONS } from '../../src/content/dailyQuestions.js';
import { dateKey, addDays } from '../../src/domain/dates.js';
import type { SheetsClient } from './client.js';
import { SHEETS, toRow, type EntitySpec } from './schema.js';
import { parseTable, type Cell, type Grid } from './table.js';

/**
 * An in-memory stand-in for the Data Hub workbook. It is used by the tests and by local development
 * (SHEETS_MOCK=1), so the whole path (API → hub → mapping → UI) can run with no Google account.
 * It is never used in production: the Vercel handlers only build a Google client.
 */
export function createFakeSheets(initial: Record<string, Grid>): SheetsClient & { grids: Record<string, Grid>; calls: string[] } {
  const grids: Record<string, Grid> = JSON.parse(JSON.stringify(initial));
  const calls: string[] = [];
  const need = (sheet: string) => {
    if (!grids[sheet]) throw new Error(`No sheet ${sheet}`);
    return grids[sheet];
  };
  return {
    grids,
    calls,
    async readSheets(names) {
      calls.push(`read:${names.join(',')}`);
      return Object.fromEntries(names.map((n) => [n, JSON.parse(JSON.stringify(need(n)))]));
    },
    async updateCells(sheet, writes) {
      calls.push(`update:${sheet}:${writes.length}`);
      for (const w of writes) {
        const row = need(sheet)[w.row - 1];
        while (row.length <= w.column) row.push('');
        row[w.column] = w.value ?? '';
      }
    },
    async appendRow(sheet, row) {
      calls.push(`append:${sheet}`);
      need(sheet).push([...row]);
    },
    async deleteRow(sheet, row) {
      calls.push(`delete:${sheet}`);
      need(sheet).splice(row - 1, 1);
    },
  };
}

const headerOf = (spec: EntitySpec): string[] => [spec.idColumn, ...spec.fields.map((f) => f.column ?? f.key)];

function sheetOf(spec: EntitySpec, rows: { id: string; values: Record<string, unknown> }[]): Grid {
  const header = headerOf(spec);
  const table = parseTable([header]);
  return [header, ...rows.map((r) => toRow(table, spec, r.id, r.values).row)];
}

/** A realistic workbook built from the demo data, with sheet-style ids (TASK-001, PRJ-001…). */
export function buildFixtureWorkbook(now: Date): Record<string, Grid> {
  const seed = buildSeed(now);
  const pad = (n: number, w = 3) => String(n).padStart(w, '0');
  const projectIds = new Map(seed.projects.map((p, i) => [p.id, `PRJ-${pad(i + 1)}`]));
  const wsIds = new Map(seed.workstreams.map((w, i) => [w.id, `WS-${pad(i + 1)}`]));
  const taskIds = new Map(seed.tasks.map((t, i) => [t.id, `TASK-${pad(i + 1)}`]));
  const pid = (x: string | null) => (x ? projectIds.get(x) ?? x : null);
  const wid = (x: string | null) => (x ? wsIds.get(x) ?? x : null);
  const day = (iso: string | null) => (iso ? dateKey(new Date(iso)) : null);

  const tasks = sheetOf(SHEETS.tasks, seed.tasks.map((t) => ({
    id: taskIds.get(t.id)!,
    values: { ...t, project_id: pid(t.project_id), workstream_id: wid(t.workstream_id), deadline: day(t.deadline), assigned_person_id: null },
  })));
  const projects = sheetOf(SHEETS.projects, seed.projects.map((p) => ({ id: projectIds.get(p.id)!, values: { ...p } })));
  const wsSpec = { ...SHEETS.workstreams };
  const workstreams = sheetOf(wsSpec, seed.workstreams.map((w) => ({ id: wsIds.get(w.id)!, values: { ...w, project_id: pid(w.project_id) } })));
  // Trip dates live in extra columns, as a person would add them.
  workstreams[0].push('start_date', 'end_date');
  workstreams.slice(1).forEach((row, i) => {
    const m = seed.workstreams[i].metadata as { start_date?: string; end_date?: string };
    row.push(m.start_date ?? '', m.end_date ?? '');
  });
  const decisions = sheetOf(SHEETS.decisions, seed.decisions.map((d, i) => ({
    id: `DEC-${pad(i + 1)}`,
    values: { ...d, project_id: pid(d.project_id), workstream_id: wid(d.workstream_id), people_involved: '' },
  })));
  const notes = sheetOf(SHEETS.notes, []);
  const dq: Grid = sheetOf(SHEETS.dailyQuestions, [0, 1, 2].map((n) => ({
    id: `Q-${pad(n + 1)}`,
    values: { date: dateKey(addDays(now, n)), question: DAILY_QUESTIONS[(n + 3) % DAILY_QUESTIONS.length], answer: null },
  })));
  const syncLog = sheetOf(SHEETS.syncLog, []);

  return { Tasks: tasks, Projects: projects, Workstreams: workstreams, Decisions: decisions, Notes: notes, Daily_Questions: dq, Sync_Log: syncLog };
}

export type { Cell };
