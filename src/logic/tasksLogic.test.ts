import { describe, expect, it } from 'vitest';
import type { InboxItem, Task } from '../domain/types';
import { applyChange } from './bookkeeping';
import { buildCleanupQueue } from './cleanup';
import { buildDecisions, decisionsLead } from './decisions';
import { applyFilters, EMPTY_FILTERS, filterCaptures } from './filters';
import { buildSummary } from './summary';
import { statusPatch } from './taskActions';
import { newTask } from './taskFactory';
import { DEFAULT_THRESHOLDS } from './thresholds';
import { wouldOverload } from './wip';

const now = new Date(2026, 9, 7, 14, 0, 0); // Wed 7 Oct 2026
const ago = (days: number) => new Date(2026, 9, 7 - days, 9, 0, 0).toISOString();
let n = 0;
const task = (over: Partial<Task> = {}): Task =>
  newTask({ id: `t${++n}`, title: `Task ${n}`, status: 'planned', scheduled_date: '2026-10-08', created_at: ago(20), last_activity_at: ago(1), ...over }, now);
const cap = (days: number): InboxItem => ({ id: `c${++n}`, content: `Capture ${n}`, created_at: ago(days), status: 'inbox' });
const name = () => '';

describe('bookkeeping and history', () => {
  it('sets waiting_since / backlog_since and records status changes', () => {
    const t = task({ status: 'planned' });
    const w = applyChange(t, { status: 'waiting' }, now);
    expect(w.patch.waiting_since).toBe(now.toISOString());
    expect(w.events.map((e) => e.type)).toEqual(['status_changed']);
    const b = applyChange({ ...t, status: 'waiting', waiting_since: ago(3) }, { status: 'backlog' }, now);
    expect(b.patch.waiting_since).toBeNull();
    expect(b.patch.backlog_since).toBe(now.toISOString());
  });
  it('distinguishes completed and reopened', () => {
    const t = task({ status: 'in_progress' });
    expect(applyChange(t, { status: 'done' }, now).events[0].type).toBe('completed');
    expect(applyChange({ ...t, status: 'done' }, { status: 'planned' }, now).events[0].type).toBe('reopened');
  });
  it('counts only postponements as reschedules', () => {
    const t = task({ scheduled_date: '2026-10-08' });
    const later = applyChange(t, { scheduled_date: '2026-10-12' }, now);
    expect(later.patch.reschedule_count).toBe(1);
    expect(later.events[0].type).toBe('rescheduled');
    const earlier = applyChange(t, { scheduled_date: '2026-10-07' }, now);
    expect(earlier.patch.reschedule_count).toBeUndefined();
    expect(earlier.events[0].type).toBe('moved_to_today');
    const first = applyChange(task({ scheduled_date: null }), { scheduled_date: '2026-10-07' }, now);
    expect(first.events[0].type).toBe('moved_to_today');
    expect(applyChange(task({ scheduled_date: null }), { scheduled_date: '2026-10-20' }, now).events[0].type).toBe('scheduled');
  });
  it('records deadline, priority, delegation and review', () => {
    const t = task();
    const types = applyChange(t, { deadline: ago(-3), priority: 'high', delegated_to: 'Marc', last_reviewed_at: now.toISOString() }, now).events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['deadline_changed', 'priority_changed', 'delegated', 'reviewed']));
  });
  it('maps Kanban moves to sensible patches', () => {
    const t = task({ status: 'planned', scheduled_date: '2026-10-08', is_focus: true });
    expect(statusPatch(t, 'backlog', now).scheduled_date).toBeNull();
    expect(statusPatch(t, 'done', now).completed_at).toBe(now.toISOString());
    expect(statusPatch({ ...t, status: 'done' }, 'in_progress', now).status).toBe('in_progress');
  });
});

describe('needs decision', () => {
  it('reports each task once under its most severe reason and lists the others', () => {
    const t = task({ deadline: ago(2), reschedule_count: 4 });
    const items = buildDecisions([t], [], now);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('overdue');
    expect(items[0].also).toContain('repeated_reschedule');
  });
  it('flags waiting too long with the example actions', () => {
    const [w] = buildDecisions([task({ status: 'waiting', scheduled_date: null, last_activity_at: ago(11) })], [], now);
    expect(w.kind).toBe('waiting_too_long');
    expect(w.actions).toEqual(['follow_up', 'keep_waiting', 'schedule', 'drop']);
  });
  it('flags work with no next action, and old inbox tasks and captures', () => {
    const kinds = buildDecisions(
      [task({ scheduled_date: null }), task({ status: 'inbox', scheduled_date: null, created_at: ago(5) }), task({ status: 'inbox', scheduled_date: null, created_at: ago(1) })],
      [cap(6), cap(0)],
      now,
    ).map((d) => d.kind);
    expect(kinds.sort()).toEqual(['no_next_action', 'unprocessed_inbox', 'unprocessed_inbox']);
  });
  it('a Keep (review) silences stale backlog until the clock runs out again', () => {
    const stale = task({ status: 'backlog', scheduled_date: null, backlog_since: ago(40), last_activity_at: ago(40) });
    expect(buildDecisions([stale], [], now)[0].kind).toBe('stale_backlog');
    expect(buildDecisions([{ ...stale, last_reviewed_at: ago(0) }], [], now)).toHaveLength(0);
  });
  it('builds the facilitation counts', () => {
    const items = buildDecisions([task({ deadline: ago(1), reschedule_count: 3 }), task({ deadline: ago(2) })], [], now);
    expect(decisionsLead(items)).toMatchObject({ total: 2, overdue: 2, overdueRepeated: 1 });
  });
});

describe('assistant summary', () => {
  it('interprets overload, stale and waiting work and recommends one action', () => {
    const tasks = [
      ...Array.from({ length: 8 }, () => task({ status: 'in_progress', scheduled_date: null, last_activity_at: ago(1) })),
      ...Array.from({ length: 3 }, () => task({ status: 'in_progress', scheduled_date: null, last_activity_at: ago(9) })),
      task({ status: 'waiting', scheduled_date: null, last_activity_at: ago(12) }),
    ];
    const s = buildSummary(tasks, [], now);
    expect(s.active).toBe(12);
    expect(s.observations.length).toBeLessThanOrEqual(4);
    expect(s.observations[0]).toMatchObject({ code: 'wip', n: 11, extra: 5 });
    expect(s.recommendation).toBe('reduce_wip_review_waiting');
  });
  it('stays quiet when nothing is wrong', () => {
    const s = buildSummary([task(), task({ status: 'in_progress' })], [], now);
    expect(s.observations).toHaveLength(0);
    expect(s.recommendation).toBeNull();
  });
});

describe('filters', () => {
  const tasks = [
    task({ title: 'Zurich landlord', project_id: 'p1', status: 'waiting', last_activity_at: ago(12), deadline: ago(2) }),
    task({ title: 'Brokerage memo', project_id: 'p2', status: 'waiting', last_activity_at: ago(1) }),
    task({ title: 'Zurich plans', project_id: 'p1', status: 'planned', scheduled_date: '2026-10-07' }),
  ];
  it('combines facets (Project + Status + Overdue)', () => {
    const out = applyFilters(tasks, { ...EMPTY_FILTERS, project: 'p1', status: 'waiting', overdue: true }, now, name);
    expect(out.map((t) => t.title)).toEqual(['Zurich landlord']);
  });
  it('searches words in any order and handles Scheduled today', () => {
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, query: 'landlord zurich' }, now, name)).toHaveLength(1);
    expect(applyFilters(tasks, { ...EMPTY_FILTERS, today: true }, now, name).map((t) => t.title)).toEqual(['Zurich plans']);
  });
  it('captures only answer to search and Inbox', () => {
    expect(filterCaptures([cap(1)], { ...EMPTY_FILTERS, priority: 'high' })).toHaveLength(0);
    expect(filterCaptures([cap(1)], EMPTY_FILTERS)).toHaveLength(1);
  });
});

describe('weekly cleanup and WIP', () => {
  it('queues stale work first, skips overdue and recently reviewed, caps the length', () => {
    const tasks = [
      task({ deadline: ago(3) }),
      task({ status: 'backlog', scheduled_date: null, backlog_since: ago(37), last_activity_at: ago(37), project_id: 'p' }),
      task({ status: 'backlog', scheduled_date: null, backlog_since: ago(50), last_activity_at: ago(50), project_id: 'p', last_reviewed_at: ago(1) }),
      task({ status: 'in_progress', last_activity_at: ago(8) }),
      task({ project_id: null, scheduled_date: '2026-10-09', created_at: ago(15) }),
    ];
    const q = buildCleanupQueue(tasks, [cap(9)], now);
    expect(q.map((x) => x.kind)).toEqual(['stale_backlog', 'lost_attention', 'unprocessed_inbox', 'no_project']);
    expect(q[0].actions).toEqual(['schedule', 'keep', 'delegate', 'drop']);
    const many = Array.from({ length: 30 }, () => task({ status: 'backlog', scheduled_date: null, backlog_since: ago(40), last_activity_at: ago(40) }));
    expect(buildCleanupQueue(many, [], now)).toHaveLength(DEFAULT_THRESHOLDS.cleanupMaxItems);
  });
  it('warns only when a new task would exceed the limit', () => {
    const five = Array.from({ length: 5 }, () => task({ status: 'in_progress' }));
    expect(wouldOverload(five, 5)).toBe(true);
    expect(wouldOverload(five, 5, five[0].id)).toBe(false);
    expect(wouldOverload(five.slice(0, 4), 5)).toBe(false);
  });
});
