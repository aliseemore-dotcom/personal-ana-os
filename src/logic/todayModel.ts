import type { Task } from '../domain/types';
import { dateKey, endOfDay } from '../domain/dates';
import { rankTasks, type Scored } from './prioritisation';

export const MAX_PRIORITY_TASKS = 3;
export const MAX_QUICK_TASKS = 5;
export const QUICK_TASK_MINUTES = 15;

export interface TodayModel {
  focus: Scored | null;
  /** True when the user picked the focus; false when it is the suggestion. */
  focusIsManual: boolean;
  priority: Scored[];
  quick: Scored[];
  /** Planned for today but not shown, to keep the page short. */
  hiddenCount: number;
  doneToday: number;
  /** Everything that could be today's focus, best first. */
  candidates: Scored[];
}

const ACTIVE: Task['status'][] = ['planned', 'in_progress'];

function isForToday(task: Task, now: Date): boolean {
  if (!ACTIVE.includes(task.status)) return false;
  if (task.scheduled_date && task.scheduled_date <= dateKey(now)) return true;
  if (task.deadline && new Date(task.deadline).getTime() <= endOfDay(now).getTime()) return true;
  return false;
}

/**
 * @param linger ids of tasks completed a moment ago that stay on screen (struck through,
 * with undo) so the layout does not jump the instant something is ticked off.
 */
export interface Linger {
  ids: ReadonlySet<string>;
  /** The lingering task that was the focus, so the Focus card can show it as done. */
  focusId: string | null;
}

export const NO_LINGER: Linger = { ids: new Set(), focusId: null };

export function buildToday(tasks: Task[], now: Date, linger: Linger = NO_LINGER): TodayModel {
  const keep = linger.ids;
  const today = dateKey(now);
  const pool = tasks.filter(
    (t) => (t.status === 'done' ? keep.has(t.id) : isForToday(t, now) || t.is_focus),
  );
  const ranked = rankTasks(pool, now);
  // Lingering done tasks keep the place they had; rank them as if still open.
  const lingering = linger.focusId ? ranked.find((s) => s.task.id === linger.focusId) ?? null : null;
  const manual = lingering ?? ranked.find((s) => s.task.is_focus) ?? null;
  const focus = manual ?? ranked.find((s) => s.task.status !== 'done') ?? null;

  const rest = ranked.filter((s) => s !== focus);
  const isQuick = (s: Scored) =>
    s.task.estimated_duration !== null && s.task.estimated_duration <= QUICK_TASK_MINUTES;
  const quickAll = rest.filter(isQuick);
  const priorityAll = rest.filter((s) => !isQuick(s));
  const priority = priorityAll.slice(0, MAX_PRIORITY_TASKS);
  const quick = quickAll.slice(0, MAX_QUICK_TASKS);
  const shownOpen = [focus, ...priority, ...quick].filter((s) => s && s.task.status !== 'done').length;

  const doneToday = tasks.filter(
    (t) => t.status === 'done' && t.completed_at && dateKey(new Date(t.completed_at)) === today,
  ).length;

  return {
    focus,
    focusIsManual: manual !== null,
    priority,
    quick,
    hiddenCount: Math.max(0, ranked.filter((s) => s.task.status !== 'done').length - shownOpen),
    doneToday,
    candidates: ranked.filter((s) => s.task.status !== 'done'),
  };
}
