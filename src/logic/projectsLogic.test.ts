import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import type { ProjectEvent, Task } from '../domain/types';
import { assessProject } from './projectHealth';
import { newProject, newWorkstream } from './projectFactory';
import { buildProjectsSummary } from './projectsSummary';
import { EMPTY_PROJECT_FILTERS, buildTimeline, filterProjects, sortProjects, splitTasks, type ProjectView } from './projectViews';
import { newTask } from './taskFactory';

const now = new Date(2026, 9, 7, 14, 0, 0);
const ago = (d: number) => new Date(2026, 9, 7 - d, 9, 0, 0).toISOString();
const proj = (over = {}) => newProject({ id: 'p1', name: 'P1', category: 'work', last_activity_at: ago(1), ...over }, now);
let n = 0;
const task = (over: Partial<Task> = {}) => newTask({ id: `t${++n}`, title: `T${n}`, status: 'planned', project_id: 'p1', scheduled_date: '2026-10-08', last_activity_at: ago(1), ...over }, now);
const view = (p = proj(), tasks: Task[] = [], ws = [] as ReturnType<typeof newWorkstream>[]): ProjectView => ({ project: p, tasks, workstreams: ws, assessment: assessProject(p, tasks, ws, now) });

describe('project health', () => {
  it('a blocker alone is "needs attention"; with nothing planned it is "blocked"', () => {
    expect(assessProject(proj({ blocker: 'Awaiting pricing', next_action: 'Draft brief' }), [], [], now).health).toBe('needs_attention');
    expect(assessProject(proj({ blocker: 'Awaiting pricing' }), [], [], now).health).toBe('blocked');
  });
  it('takes the next action from tasks when none is written, and flags when there is neither', () => {
    const withTask = assessProject(proj(), [task({ title: 'Call the notary' })], [], now);
    expect(withTask.next).toEqual({ text: 'Call the notary', from: 'task' });
    expect(withTask.hasNextAction).toBe(true);
    const none = assessProject(proj(), [], [], now);
    expect(none.signals.map((s) => s.code)).toContain('no_next_action');
    expect(none.health).toBe('on_track'); // noted, but not alarming on its own
    expect(assessProject(proj({ blocker: 'x' }), [], [], now).health).toBe('blocked');
  });
  it('flags overdue tasks, an overdue milestone, and long waiting', () => {
    const a = assessProject(proj({ next_action: 'x', next_milestone: 'Outreach', next_milestone_date: '2026-10-01' }), [task({ deadline: ago(2) })], [], now);
    expect(a.signals.map((s) => s.code)).toEqual(expect.arrayContaining(['overdue_tasks', 'overdue_milestone']));
    const w = assessProject(proj({ status: 'waiting', next_action: 'x', last_activity_at: ago(10) }), [], [], now);
    expect(w.signals.find((s) => s.code === 'waiting_long')?.n).toBe(10);
  });
  it('lets a project be paused or finished without nagging', () => {
    expect(assessProject(proj({ status: 'on_hold', last_activity_at: ago(60) }), [], [], now).signals).toHaveLength(0);
    const done = assessProject(proj({ status: 'completed', blocker: 'old', health: 'blocked' }), [task({ deadline: ago(5) })], [], now);
    expect(done.health).toBe('on_track');
    expect(done.signals).toHaveLength(0);
  });
  it('notices workstreams that have not moved', () => {
    const ws = [newWorkstream({ project_id: 'p1', name: 'A', last_activity_at: ago(30) }, now), newWorkstream({ project_id: 'p1', name: 'B', last_activity_at: ago(1) }, now)];
    expect(assessProject(proj({ next_action: 'x' }), [], ws, now).signals.find((s) => s.code === 'workstream_stalled')?.n).toBe(1);
  });
});

describe('projects summary, filters and views', () => {
  const calm = view(proj({ id: 'a', name: 'Calm', next_action: 'x' }));
  const stuck = view(proj({ id: 'b', name: 'Stuck', status: 'waiting', next_action: 'x', last_activity_at: ago(12), category: 'business' }));
  const empty = view(proj({ id: 'c', name: 'Empty', category: 'personal' }));
  const done = view(proj({ id: 'd', name: 'Done', status: 'completed' }));
  const all = [calm, stuck, empty, done];

  it('interprets state in calm language and counts each kind once', () => {
    const s = buildProjectsSummary(all);
    expect(s).toMatchObject({ total: 4, active: 2, needAttention: 1, noNextAction: 1 });
    expect(s.lines.map((l) => l.code)).toEqual(['waiting_long', 'no_next_action']);
  });
  it('orders the lines by urgency: danger first, neutral last, and each carries its tone', () => {
    const overdue = view(proj({ id: 'o', name: 'Overdue one', next_action: 'x' }), [task({ project_id: 'o', deadline: ago(3) })]);
    const blocked = view(proj({ id: 'k', name: 'Blocked one', next_action: 'x', blocker: 'Awaiting pricing' }));
    const s = buildProjectsSummary([overdue, blocked, empty, calm]);
    expect(s.lines.map((l) => [l.tone, l.project])).toEqual([
      ['danger', 'Blocked one'],
      ['warning', 'Overdue one'],
      ['neutral', 'Empty'],
    ]);
  });
  it('filters by category, status, health and search (including workstream names)', () => {
    expect(filterProjects(all, { ...EMPTY_PROJECT_FILTERS, category: 'business' }).map((v) => v.project.name)).toEqual(['Stuck']);
    expect(filterProjects(all, { ...EMPTY_PROJECT_FILTERS, health: 'needs_attention' })).toHaveLength(1);
    expect(filterProjects(all, { ...EMPTY_PROJECT_FILTERS, status: 'completed' })).toHaveLength(1);
    const withWs = view(proj({ id: 'e', name: 'Container' }), [], [newWorkstream({ project_id: 'e', name: 'Milan' }, now)]);
    expect(filterProjects([withWs, calm], { ...EMPTY_PROJECT_FILTERS, query: 'milan' })).toHaveLength(1);
  });
  it('puts completed projects last and the ones needing a look first', () => {
    expect(sortProjects(all).map((v) => v.project.name)).toEqual(['Stuck', 'Calm', 'Empty', 'Done']);
  });
});

describe('project tasks and timeline', () => {
  it('splits tasks into Current / Upcoming / Waiting / Completed', () => {
    const g = splitTasks(
      [task({ scheduled_date: '2026-10-07' }), task({ scheduled_date: '2026-10-20' }), task({ status: 'backlog', scheduled_date: null }), task({ status: 'waiting' }), task({ status: 'done', completed_at: ago(1) }), task({ status: 'in_progress', scheduled_date: null })],
      now,
    );
    expect(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length]))).toEqual({ current: 2, upcoming: 2, waiting: 1, completed: 1 });
  });
  it('builds the timeline from stored events plus task completions, scoped to a workstream', () => {
    const events: ProjectEvent[] = [
      { id: 'e1', project_id: 'p1', workstream_id: null, type: 'project_created', at: ago(20), title: 'P1', ref_id: null },
      { id: 'e2', project_id: 'p1', workstream_id: 'w1', type: 'decision_recorded', at: ago(3), title: 'D', ref_id: 'd' },
      { id: 'e3', project_id: 'other', workstream_id: null, type: 'project_created', at: ago(1), title: 'O', ref_id: null },
    ];
    const tasks = [task({ status: 'done', completed_at: ago(2), workstream_id: 'w1' }), task({ status: 'done', completed_at: ago(1), project_id: 'other' })];
    expect(buildTimeline(events, tasks, 'p1', null).map((e) => e.type)).toEqual(['task_completed', 'decision_recorded', 'project_created']);
    expect(buildTimeline(events, tasks, 'p1', 'w1').map((e) => e.type)).toEqual(['task_completed', 'decision_recorded']);
  });
});

describe('seed matches the brief', () => {
  const seed = buildSeed(now);
  const byName = (name: string) => seed.projects.find((p) => p.name === name)!;
  const children = (name: string) => seed.workstreams.filter((w) => w.project_id === byName(name).id).map((w) => w.name);

  it('has the nine top-level projects in the right categories', () => {
    expect(seed.projects.map((p) => [p.name, p.category])).toEqual([
      ['Kofman + Partners', 'work'], ['Hotel & Investment Pipeline', 'work'], ['Restaurant Expansion', 'work'],
      ['NeoSoul', 'business'], ['BLACKBOOK', 'business'],
      ['British Citizenship', 'personal'], ['Travel & Holidays', 'personal'], ['Financial Plan', 'personal'], ['Home & Property', 'personal'],
    ]);
  });
  it('keeps opportunities, locations, workstreams and trips inside their projects', () => {
    expect(children('Hotel & Investment Pipeline')).toHaveLength(9);
    expect(children('Hotel & Investment Pipeline')).toEqual(expect.arrayContaining(['Watford FC', 'Phuket / Natai', 'Paul Ricard / F1']));
    expect(children('Restaurant Expansion')).toEqual(['Zurich', 'Milan']);
    expect(children('NeoSoul')).toEqual(['Product', 'Telegram MVP', 'Pearl Journal', 'Website & Branding', 'Content', 'Books']);
    expect(children('Travel & Holidays')).toEqual(['Ibiza']);
    const ibiza = seed.workstreams.find((w) => w.name === 'Ibiza')!;
    expect(ibiza.metadata).toMatchObject({ start_date: '2026-10-15', end_date: '2026-10-19' });
  });
  it('does not invent deal information for opportunities', () => {
    for (const w of seed.workstreams.filter((x) => x.type === 'opportunity')) {
      expect([w.summary, w.next_action, w.blocker, w.next_milestone]).toEqual([null, null, null, null]);
    }
  });
  it('links every task, workstream and decision to a record that exists', () => {
    const pids = new Set(seed.projects.map((p) => p.id));
    const wsById = new Map(seed.workstreams.map((w) => [w.id, w]));
    for (const t of seed.tasks) {
      if (t.project_id) expect(pids.has(t.project_id)).toBe(true);
      if (t.workstream_id) expect(wsById.get(t.workstream_id)?.project_id).toBe(t.project_id);
    }
    for (const d of seed.decisions) expect(pids.has(d.project_id)).toBe(true);
  });
});
