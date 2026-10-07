import type { InboxItem, Task } from '../domain/types';
import { calendarDaysBetween } from '../domain/dates';
import { classify, idleSince } from './attention';
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds';

export type ObservationCode = 'wip' | 'overdue' | 'waiting' | 'stale' | 'inbox' | 'backlog' | 'no_project' | 'no_deadline';
export type RecommendationCode =
  | 'reduce_wip_review_waiting'
  | 'reduce_wip'
  | 'decide_overdue'
  | 'follow_up_waiting'
  | 'review_stale'
  | 'process_inbox'
  | 'trim_backlog'
  | 'assign_projects'
  | 'set_deadlines';

export interface Observation {
  code: ObservationCode;
  n: number;
  /** wip: the limit. overdue: how many were rescheduled repeatedly. */
  extra?: number;
  tone: 'critical' | 'warn' | 'info';
}

export interface Summary {
  active: number;
  observations: Observation[];
  recommendation: RecommendationCode | null;
}

const WEIGHT: Record<ObservationCode, number> = { wip: 95, overdue: 90, waiting: 80, stale: 70, inbox: 60, backlog: 40, no_project: 20, no_deadline: 15 };
const ACTIVE: Task['status'][] = ['planned', 'in_progress', 'waiting'];
const MAX_OBSERVATIONS = 4;

/** Interprets the task data. Returns codes; wording lives in strings.ts. */
export function buildSummary(tasks: Task[], captures: InboxItem[], now: Date, t: Thresholds = DEFAULT_THRESHOLDS): Summary {
  const active = tasks.filter((x) => ACTIVE.includes(x.status));
  const open = tasks.filter((x) => x.status !== 'done');
  const found: Observation[] = [];

  const inProgress = tasks.filter((x) => x.status === 'in_progress').length;
  if (inProgress > t.wipLimit) found.push({ code: 'wip', n: inProgress, extra: t.wipLimit, tone: 'warn' });

  const classified = open.map((x) => ({ task: x, c: classify(x, now, t) }));
  const overdue = classified.filter((x) => x.c?.kind === 'overdue');
  if (overdue.length) {
    found.push({
      code: 'overdue',
      n: overdue.length,
      extra: overdue.filter((x) => x.task.reschedule_count >= t.repeatedRescheduleCount).length,
      tone: 'critical',
    });
  }

  const waiting = classified.filter((x) => x.c?.kind === 'waiting').length;
  if (waiting) found.push({ code: 'waiting', n: waiting, tone: 'warn' });

  const stale = classified.filter(
    (x) => ACTIVE.includes(x.task.status) && x.c?.kind !== 'overdue' && x.c?.kind !== 'waiting' && calendarDaysBetween(idleSince(x.task), now) > t.idleWeekDays,
  ).length;
  if (stale) found.push({ code: 'stale', n: stale, tone: 'warn' });

  const oldInbox =
    tasks.filter((x) => x.status === 'inbox' && calendarDaysBetween(new Date(x.created_at), now) >= t.unprocessedInboxDays).length +
    captures.filter((c) => c.status === 'inbox' && calendarDaysBetween(new Date(c.created_at), now) >= t.unprocessedInboxDays).length;
  if (oldInbox) found.push({ code: 'inbox', n: oldInbox, tone: 'info' });

  const backlog = tasks.filter((x) => x.status === 'backlog').length;
  if (backlog > t.largeBacklog) found.push({ code: 'backlog', n: backlog, tone: 'info' });

  const noProject = active.filter((x) => !x.project_id).length;
  if (noProject >= 5) found.push({ code: 'no_project', n: noProject, tone: 'info' });

  const noDeadline = active.filter((x) => !x.deadline).length;
  if (noDeadline >= 10 && noDeadline / Math.max(1, active.length) > 0.5) found.push({ code: 'no_deadline', n: noDeadline, tone: 'info' });

  found.sort((a, b) => WEIGHT[b.code] - WEIGHT[a.code]);
  const has = (c: ObservationCode) => found.some((o) => o.code === c);

  let recommendation: RecommendationCode | null = null;
  if (has('wip')) recommendation = has('waiting') ? 'reduce_wip_review_waiting' : 'reduce_wip';
  else if (has('overdue')) recommendation = 'decide_overdue';
  else if (has('waiting')) recommendation = 'follow_up_waiting';
  else if (has('stale')) recommendation = 'review_stale';
  else if (has('inbox')) recommendation = 'process_inbox';
  else if (has('backlog')) recommendation = 'trim_backlog';
  else if (has('no_project')) recommendation = 'assign_projects';
  else if (has('no_deadline')) recommendation = 'set_deadlines';

  return { active: active.length, observations: found.slice(0, MAX_OBSERVATIONS), recommendation };
}
