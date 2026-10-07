import type { InboxItem, Task } from '../domain/types';
import { calendarDaysBetween } from '../domain/dates';
import { buildDecisions, type DecisionAction, type DecisionItem, type DecisionKind } from './decisions';
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds';

export type CleanupKind = Exclude<DecisionKind, 'overdue'> | 'no_project';

export interface CleanupItem {
  id: string;
  kind: CleanupKind;
  task?: Task;
  capture?: InboxItem;
  days: number;
  /** Actions in Weekly cleanup: Schedule, Keep, Delegate, Delete (+ Backlog when it isn't there already). */
  actions: DecisionAction[];
}

const ORDER: CleanupKind[] = ['stale_backlog', 'lost_attention', 'repeated_reschedule', 'waiting_too_long', 'unprocessed_inbox', 'no_project', 'no_next_action'];

/**
 * Picks the stale, ambiguous and unresolved work for the weekly walk-through.
 * Overdue tasks are left to "Needs decision"; recently reviewed tasks are skipped.
 */
export function buildCleanupQueue(tasks: Task[], captures: InboxItem[], now: Date, t: Thresholds = DEFAULT_THRESHOLDS): CleanupItem[] {
  const recentlyReviewed = (task: Task) =>
    task.last_reviewed_at !== null && calendarDaysBetween(new Date(task.last_reviewed_at), now) < t.cleanupRecentReviewDays;

  const everything = buildDecisions(tasks, captures, now, t);
  const fromDecisions = everything
    .filter((d): d is DecisionItem & { kind: Exclude<DecisionKind, 'overdue'> } => d.kind !== 'overdue')
    .filter((d) => !(d.task && recentlyReviewed(d.task)));

  const seen = new Set(everything.map((d) => d.id));
  const noProject: CleanupItem[] = tasks
    .filter(
      (x) =>
        !seen.has(x.id) &&
        !x.project_id &&
        ['planned', 'in_progress', 'backlog', 'waiting'].includes(x.status) &&
        calendarDaysBetween(new Date(x.created_at), now) >= 7 &&
        !recentlyReviewed(x),
    )
    .map((task) => ({ id: task.id, kind: 'no_project', task, days: calendarDaysBetween(new Date(task.created_at), now), actions: [] }));

  const all: CleanupItem[] = [
    ...fromDecisions.map<CleanupItem>((d) => ({ id: d.id, kind: d.kind, task: d.task, capture: d.capture, days: d.days, actions: [] })),
    ...noProject,
  ];
  all.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || b.days - a.days);

  return all.slice(0, t.cleanupMaxItems).map((it) => ({
    ...it,
    actions: ['schedule', 'keep', 'delegate', ...(it.task?.status === 'backlog' ? [] : (['backlog'] as DecisionAction[])), 'drop'],
  }));
}
