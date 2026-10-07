import type { Task } from '../domain/types';
import { calendarDaysBetween, workingDaysBetween } from '../domain/dates';
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds';

export { DEFAULT_THRESHOLDS };
export type AttentionThresholds = Thresholds;

export type AttentionKind = 'overdue' | 'waiting' | 'lost_attention' | 'stale_backlog';
/** What the UI shows: lost attention + stale backlog are both "forgotten". */
export type AttentionGroup = 'overdue' | 'waiting' | 'forgotten';

/** The later of last activity and last review: "Keep" and "Follow up" restart the clock. */
export function idleSince(task: Task): Date {
  const a = new Date(task.last_activity_at).getTime();
  const r = task.last_reviewed_at ? new Date(task.last_reviewed_at).getTime() : 0;
  return new Date(Math.max(a, r));
}

function backlogSince(task: Task): Date {
  const base = new Date(task.backlog_since ?? task.last_activity_at).getTime();
  const r = task.last_reviewed_at ? new Date(task.last_reviewed_at).getTime() : 0;
  return new Date(Math.max(base, r));
}

export interface AttentionItem {
  task: Task;
  kind: AttentionKind;
  group: AttentionGroup;
  /** Days overdue / working days waiting / days idle / days in backlog. */
  days: number;
}

const groupOf = (k: AttentionKind): AttentionGroup =>
  k === 'overdue' ? 'overdue' : k === 'waiting' ? 'waiting' : 'forgotten';

/**
 * A task is reported once, under the most urgent rule it matches:
 * overdue > waiting too long > lost attention > stale backlog.
 */
export function classify(task: Task, now: Date, t: Thresholds = DEFAULT_THRESHOLDS): AttentionItem | null {
  if (task.status === 'done') return null;
  const last = idleSince(task);
  const make = (kind: AttentionKind, days: number): AttentionItem => ({ task, kind, group: groupOf(kind), days });

  if (task.deadline) {
    const deadline = new Date(task.deadline);
    if (deadline.getTime() < now.getTime()) {
      return make('overdue', Math.max(1, calendarDaysBetween(deadline, now)));
    }
  }
  if (task.status === 'waiting') {
    const d = workingDaysBetween(last, now);
    if (d >= t.waitingWorkingDays) return make('waiting', d);
  }
  if (task.status === 'in_progress') {
    const d = calendarDaysBetween(last, now);
    if (d >= t.lostAttentionDays) return make('lost_attention', d);
  }
  if (task.status === 'backlog') {
    const d = calendarDaysBetween(backlogSince(task), now);
    if (d > t.staleBacklogDays) return make('stale_backlog', d);
  }
  return null;
}

export interface AttentionSummary {
  items: AttentionItem[];
  byGroup: Record<AttentionGroup, AttentionItem[]>;
  total: number;
}

export function detectAttention(tasks: Task[], now: Date, t: Thresholds = DEFAULT_THRESHOLDS): AttentionSummary {
  const items = tasks
    .map((task) => classify(task, now, t))
    .filter((x): x is AttentionItem => x !== null)
    .sort((a, b) => b.days - a.days);
  const byGroup: Record<AttentionGroup, AttentionItem[]> = { overdue: [], waiting: [], forgotten: [] };
  for (const it of items) byGroup[it.group].push(it);
  return { items, byGroup, total: items.length };
}
