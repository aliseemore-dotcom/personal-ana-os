import type { Health, Project, ProjectStatus, Task, Workstream } from '../domain/types';
import { calendarDaysBetween, dateKey } from '../domain/dates';
import { rankTasks } from './prioritisation';
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds';

export type SignalCode =
  | 'blocker'
  | 'overdue_milestone'
  | 'overdue_tasks'
  | 'no_next_action'
  | 'waiting_long'
  | 'inactive'
  | 'workstream_stalled';

export interface Signal {
  code: SignalCode;
  /** overdue_tasks / workstream_stalled: how many. waiting_long / inactive: days. */
  n: number;
}

export interface ProjectAssessment {
  health: Health;
  signals: Signal[];
  hasNextAction: boolean;
  /** What to show as "next": the written Next Action, or the most pressing open task. */
  next: { text: string; from: 'written' | 'task' } | null;
  lastActivity: Date;
}

const OPEN: Task['status'][] = ['inbox', 'planned', 'in_progress', 'waiting'];
const RANK: Record<Health, number> = { on_track: 0, needs_attention: 1, blocked: 2 };
export const worstHealth = (a: Health, b: Health): Health => (RANK[a] >= RANK[b] ? a : b);

const clean = (s: string | null | undefined) => (s ?? '').trim();

function latest(...dates: (string | null | undefined)[]): Date {
  return new Date(Math.max(...dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime())));
}

/** Most pressing open, schedulable task of a project, used when no Next Action is written. */
export function topOpenTask(tasks: Task[], now: Date): Task | null {
  const open = tasks.filter((t) => ['inbox', 'planned', 'in_progress'].includes(t.status) && (t.scheduled_date || t.deadline || t.status === 'in_progress'));
  return rankTasks(open, now)[0]?.task ?? null;
}

interface Target {
  status: ProjectStatus;
  health: Health;
  next_action: string | null;
  blocker: string | null;
  next_milestone?: string | null;
  next_milestone_date?: string | null;
  last_activity_at: string;
  updated_at: string;
}

function assess(target: Target, tasks: Task[], children: Workstream[], now: Date, t: Thresholds): ProjectAssessment {
  const open = tasks.filter((x) => OPEN.includes(x.status));
  const next = clean(target.next_action)
    ? { text: clean(target.next_action), from: 'written' as const }
    : (() => {
        const top = topOpenTask(tasks, now);
        return top ? { text: top.title, from: 'task' as const } : null;
      })();
  const lastActivity = latest(target.last_activity_at, ...tasks.map((x) => x.last_activity_at), ...children.map((c) => c.last_activity_at));

  const signals: Signal[] = [];
  const paused = target.status === 'on_hold' || target.status === 'completed';
  if (target.status !== 'completed') {
    if (clean(target.blocker)) signals.push({ code: 'blocker', n: 1 });
    if (target.next_milestone_date && target.next_milestone_date < dateKey(now) && !paused) signals.push({ code: 'overdue_milestone', n: calendarDaysBetween(new Date(`${target.next_milestone_date}T12:00:00`), now) });
    const overdue = open.filter((x) => x.deadline && new Date(x.deadline) < now).length;
    if (overdue) signals.push({ code: 'overdue_tasks', n: overdue });
    if (!paused && !next) signals.push({ code: 'no_next_action', n: 0 });
    const idle = calendarDaysBetween(lastActivity, now);
    if (target.status === 'waiting' && idle >= t.projectWaitingDays) signals.push({ code: 'waiting_long', n: idle });
    else if (target.status === 'active' && idle >= t.projectInactiveDays) signals.push({ code: 'inactive', n: idle });
    const stalled = children.filter(
      (c) => c.status === 'active' && calendarDaysBetween(latest(c.last_activity_at, ...tasks.filter((x) => x.workstream_id === c.id).map((x) => x.last_activity_at)), now) >= t.projectInactiveDays,
    ).length;
    if (stalled && children.length > 1) signals.push({ code: 'workstream_stalled', n: stalled });
  }

  let health: Health = target.status === 'completed' ? 'on_track' : target.health;
  if (target.status !== 'completed') {
    if (clean(target.blocker) && !next) health = worstHealth(health, 'blocked');
    // "No next action" is shown and summarised, but on its own it does not make a project look unhealthy:
    // a freshly set-up container is not a problem.
    if (signals.some((s) => s.code !== 'no_next_action')) health = worstHealth(health, 'needs_attention');
  }
  return { health, signals, hasNextAction: next !== null, next, lastActivity };
}

/**
 * The project's own state plus what its tasks and workstreams say.
 * "Blocked" needs a blocker with nothing planned to unblock it (or a manual setting);
 * every other signal reads as "needs attention", except a missing Next Action, which is only noted.
 */
export function assessProject(p: Project, tasks: Task[], children: Workstream[], now: Date, t: Thresholds = DEFAULT_THRESHOLDS): ProjectAssessment {
  return assess(p, tasks, children, now, t);
}

export function assessWorkstream(w: Workstream, tasks: Task[], now: Date, t: Thresholds = DEFAULT_THRESHOLDS): ProjectAssessment {
  return assess({ ...w, next_milestone_date: null }, tasks, [], now, t);
}
