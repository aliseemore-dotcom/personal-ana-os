import type { InboxItem, Task } from '../domain/types';
import { calendarDaysBetween } from '../domain/dates';
import { classify } from './attention';
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds';

export type DecisionKind =
  | 'overdue'
  | 'waiting_too_long'
  | 'repeated_reschedule'
  | 'lost_attention'
  | 'no_next_action'
  | 'unprocessed_inbox'
  | 'stale_backlog';

export type DecisionAction = 'do' | 'schedule' | 'delegate' | 'wait' | 'follow_up' | 'keep_waiting' | 'backlog' | 'keep' | 'drop';

export interface DecisionItem {
  /** Task id or capture id. */
  id: string;
  kind: DecisionKind;
  task?: Task;
  capture?: InboxItem;
  /** Days (working days for waiting) that make the primary reason true, or reschedule count. */
  days: number;
  /** Other reasons that also apply. */
  also: DecisionKind[];
  actions: DecisionAction[];
  severity: number;
}

const SEVERITY: Record<DecisionKind, number> = {
  overdue: 100,
  waiting_too_long: 80,
  repeated_reschedule: 75,
  lost_attention: 70,
  no_next_action: 55,
  unprocessed_inbox: 50,
  stale_backlog: 40,
};

export const ACTIONS: Record<DecisionKind, DecisionAction[]> = {
  overdue: ['do', 'schedule', 'delegate', 'backlog', 'drop'],
  waiting_too_long: ['follow_up', 'keep_waiting', 'schedule', 'drop'],
  repeated_reschedule: ['do', 'backlog', 'delegate', 'drop'],
  lost_attention: ['do', 'schedule', 'backlog', 'drop'],
  no_next_action: ['schedule', 'do', 'wait', 'backlog', 'drop'],
  unprocessed_inbox: ['do', 'schedule', 'delegate', 'backlog', 'drop'],
  stale_backlog: ['schedule', 'keep', 'delegate', 'drop'],
};

/** All reasons a task needs a decision, with the number behind each. */
export function taskReasons(task: Task, now: Date, t: Thresholds): { kind: DecisionKind; days: number }[] {
  if (task.status === 'done') return [];
  const reasons: { kind: DecisionKind; days: number }[] = [];
  const core = classify(task, now, t);
  if (core) {
    const kind: DecisionKind = core.kind === 'waiting' ? 'waiting_too_long' : core.kind === 'lost_attention' ? 'lost_attention' : core.kind === 'stale_backlog' ? 'stale_backlog' : 'overdue';
    reasons.push({ kind, days: core.days });
  }
  if (task.reschedule_count >= t.repeatedRescheduleCount) {
    reasons.push({ kind: 'repeated_reschedule', days: task.reschedule_count });
  }
  if ((task.status === 'planned' || task.status === 'in_progress') && !task.scheduled_date && !task.deadline) {
    reasons.push({ kind: 'no_next_action', days: calendarDaysBetween(new Date(task.created_at), now) });
  }
  if (task.status === 'inbox') {
    const d = calendarDaysBetween(new Date(task.created_at), now);
    if (d >= t.unprocessedInboxDays) reasons.push({ kind: 'unprocessed_inbox', days: d });
  }
  return reasons;
}

function toItem(base: { id: string; task?: Task; capture?: InboxItem }, reasons: { kind: DecisionKind; days: number }[]): DecisionItem {
  const sorted = [...reasons].sort((a, b) => SEVERITY[b.kind] - SEVERITY[a.kind]);
  const primary = sorted[0];
  return {
    ...base,
    kind: primary.kind,
    days: primary.days,
    also: sorted.slice(1).map((r) => r.kind),
    actions: ACTIONS[primary.kind],
    severity: SEVERITY[primary.kind] * 1000 + Math.min(primary.days, 999),
  };
}

export function buildDecisions(tasks: Task[], captures: InboxItem[], now: Date, t: Thresholds = DEFAULT_THRESHOLDS): DecisionItem[] {
  const items: DecisionItem[] = [];
  for (const task of tasks) {
    const reasons = taskReasons(task, now, t);
    if (reasons.length) items.push(toItem({ id: task.id, task }, reasons));
  }
  for (const capture of captures) {
    if (capture.status !== 'inbox') continue;
    const d = calendarDaysBetween(new Date(capture.created_at), now);
    if (d >= t.unprocessedInboxDays) items.push(toItem({ id: capture.id, capture }, [{ kind: 'unprocessed_inbox', days: d }]));
  }
  return items.sort((a, b) => b.severity - a.severity);
}

export interface DecisionsLead {
  total: number;
  overdue: number;
  overdueRepeated: number;
  waiting: number;
  other: number;
}

/** Counts behind the facilitation sentence ("5 overdue, 2 of them rescheduled repeatedly"). */
export function decisionsLead(items: DecisionItem[], t: Thresholds = DEFAULT_THRESHOLDS): DecisionsLead {
  const overdue = items.filter((i) => i.kind === 'overdue');
  return {
    total: items.length,
    overdue: overdue.length,
    overdueRepeated: overdue.filter((i) => (i.task?.reschedule_count ?? 0) >= t.repeatedRescheduleCount).length,
    waiting: items.filter((i) => i.kind === 'waiting_too_long').length,
    other: items.filter((i) => i.kind !== 'overdue' && i.kind !== 'waiting_too_long').length,
  };
}
