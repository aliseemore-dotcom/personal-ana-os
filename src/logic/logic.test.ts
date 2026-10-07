import { describe, expect, it } from 'vitest';
import type { Task } from '../domain/types';
import { newTask } from './taskFactory';
import { workingDaysBetween } from '../domain/dates';
import { classify, detectAttention } from './attention';
import { scoreTask } from './prioritisation';
import { buildToday } from './todayModel';
import { completePatch, reschedulePatch } from './taskActions';

// Wednesday 7 Oct 2026, 14:00 local
const now = new Date(2026, 9, 7, 14, 0, 0);
const ago = (days: number) => new Date(2026, 9, 7 - days, 9, 0, 0).toISOString();

let n = 0;
const task = (over: Partial<Task> = {}): Task =>
  newTask(
    {
      id: `t${++n}`,
      title: `Task ${n}`,
      status: 'planned',
      scheduled_date: '2026-10-07',
      estimated_duration: 60,
      created_at: ago(40),
      updated_at: ago(1),
      last_activity_at: ago(1),
      source: 'test',
      ...over,
    },
    now,
  );

describe('working days', () => {
  it('skips weekends', () => {
    // Fri 2 Oct -> Wed 7 Oct = Mon, Tue, Wed
    expect(workingDaysBetween(new Date(2026, 9, 2), new Date(2026, 9, 7))).toBe(3);
    // Mon 28 Sep -> Wed 7 Oct = 7
    expect(workingDaysBetween(new Date(2026, 8, 28), new Date(2026, 9, 7))).toBe(7);
  });
});

describe('attention detection', () => {
  it('flags overdue only when not done', () => {
    expect(classify(task({ deadline: ago(2) }), now)?.kind).toBe('overdue');
    expect(classify(task({ deadline: ago(2), status: 'done' }), now)).toBeNull();
    expect(classify(task({ deadline: new Date(2026, 9, 7, 18).toISOString() }), now)).toBeNull();
  });
  it('flags waiting after 5 working days, not before', () => {
    // 5 Oct (Mon) -> 7 Oct: 2 working days
    expect(classify(task({ status: 'waiting', last_activity_at: ago(2) }), now)).toBeNull();
    // 28 Sep (Mon) -> 7 Oct: 7 working days
    expect(classify(task({ status: 'waiting', last_activity_at: ago(9) }), now)?.kind).toBe('waiting');
  });
  it('flags in-progress tasks idle for 5 days', () => {
    expect(classify(task({ status: 'in_progress', last_activity_at: ago(4) }), now)).toBeNull();
    expect(classify(task({ status: 'in_progress', last_activity_at: ago(6) }), now)?.kind).toBe('lost_attention');
  });
  it('flags backlog older than 30 days', () => {
    expect(classify(task({ status: 'backlog', backlog_since: ago(30), last_activity_at: ago(30) }), now)).toBeNull();
    expect(classify(task({ status: 'backlog', backlog_since: ago(31), last_activity_at: ago(31) }), now)?.kind).toBe('stale_backlog');
  });
  it('counts a task once and groups lost+stale as forgotten', () => {
    const s = detectAttention(
      [
        task({ deadline: ago(1), status: 'waiting', last_activity_at: ago(20) }),
        task({ status: 'in_progress', last_activity_at: ago(8) }),
        task({ status: 'backlog', backlog_since: ago(45), last_activity_at: ago(45) }),
      ],
      now,
    );
    expect(s.byGroup.overdue).toHaveLength(1);
    expect(s.byGroup.waiting).toHaveLength(0);
    expect(s.byGroup.forgotten).toHaveLength(2);
  });
});

describe('prioritisation', () => {
  it('ranks overdue + blocking above plain work and explains why', () => {
    const urgent = scoreTask(task({ deadline: ago(1), blocks_others: true, blocks_note: 'Investor waiting', impact_score: 9 }), now);
    const plain = scoreTask(task(), now);
    expect(urgent.score).toBeGreaterThan(plain.score);
    expect(urgent.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['overdue', 'blocks_others', 'high_impact']));
  });
});

describe('today model', () => {
  it('limits priorities to three, splits quick tasks and honours manual focus', () => {
    const tasks = [
      ...Array.from({ length: 6 }, (_, i) => task({ impact_score: i + 1 })),
      task({ estimated_duration: 10, title: 'quick' }),
      task({ status: 'backlog' }),
      task({ scheduled_date: '2026-10-09' }),
    ];
    const m = buildToday(tasks, now);
    expect(m.focus).not.toBeNull();
    expect(m.priority).toHaveLength(3);
    expect(m.quick.map((q) => q.task.title)).toEqual(['quick']);
    expect(m.hiddenCount).toBe(2);
    expect(m.hidden).toHaveLength(2);

    const chosen = tasks[0];
    const manual = buildToday(tasks.map((t) => (t === chosen ? { ...t, is_focus: true } : t)), now);
    expect(manual.focus?.task.id).toBe(chosen.id);
    expect(manual.focusIsManual).toBe(true);
  });
  it('keeps just-completed tasks on screen only while listed in keep', () => {
    const a = task({ impact_score: 9 });
    const done = { ...a, ...completePatch(now) } as Task;
    expect(buildToday([done], now).focus).toBeNull();
    expect(buildToday([done], now, { ids: new Set([a.id]), focusId: null }).priority.map((p) => p.task.id)).toEqual([a.id]);
    expect(buildToday([done], now, { ids: new Set([a.id]), focusId: a.id }).focusIsManual).toBe(true);
    expect(buildToday([done], now).doneToday).toBe(1);
  });
});

describe('task actions', () => {
  it('rescheduling an overdue task also moves the deadline and drops focus', () => {
    const t = task({ deadline: ago(3), is_focus: true });
    const p = reschedulePatch(t, new Date(2026, 9, 8), now);
    expect(p.scheduled_date).toBe('2026-10-08');
    expect(p.is_focus).toBe(false);
    expect(new Date(p.deadline!).getTime()).toBeGreaterThan(now.getTime());
  });
  it('leaves a later deadline alone', () => {
    const t = task({ deadline: new Date(2026, 9, 20).toISOString() });
    expect(reschedulePatch(t, new Date(2026, 9, 8), now).deadline).toBeUndefined();
  });
});
