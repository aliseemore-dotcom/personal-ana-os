import type { Task, TaskPatch, TaskStatus } from '../domain/types';
import { dateKey, endOfDay, fromDateKey } from '../domain/dates';

/** Pure patch builders: what each user action means for a task. */

export function completePatch(now: Date): TaskPatch {
  const iso = now.toISOString();
  return { status: 'done', completed_at: iso, is_focus: false, last_activity_at: iso };
}

export function reopenPatch(prev: TaskStatus, now: Date): TaskPatch {
  return { status: prev === 'done' ? 'planned' : prev, completed_at: null, last_activity_at: now.toISOString() };
}

/**
 * Moves the work to `day`. A deadline that would still be in the past is pushed
 * to that day too, otherwise the task would stay "overdue" after being rescheduled.
 */
export function reschedulePatch(task: Task, day: Date, now: Date): TaskPatch {
  const patch: TaskPatch = {
    scheduled_date: dateKey(day),
    is_focus: false,
    last_activity_at: now.toISOString(),
  };
  if (task.deadline && new Date(task.deadline).getTime() < endOfDay(fromDateKey(dateKey(day))).getTime()) {
    patch.deadline = endOfDay(day).toISOString();
  }
  if (task.status === 'backlog' || task.status === 'inbox') patch.status = 'planned';
  return patch;
}

export function backlogPatch(now: Date): TaskPatch {
  return { status: 'backlog', scheduled_date: null, is_focus: false, last_activity_at: now.toISOString() };
}

/** "Do": put the task on today's plan and mark it started. */
export function doNowPatch(now: Date): TaskPatch {
  return { status: 'in_progress', scheduled_date: dateKey(now), last_activity_at: now.toISOString() };
}

/** Touch: record a decision without changing anything else. */
export function touchPatch(now: Date): TaskPatch {
  return { last_activity_at: now.toISOString() };
}

/** Keep / Keep waiting: a decision was made, so the idle clocks restart. */
export function reviewPatch(now: Date): TaskPatch {
  return { last_reviewed_at: now.toISOString() };
}

export function followUpPatch(now: Date): TaskPatch {
  const iso = now.toISOString();
  return { last_activity_at: iso, last_reviewed_at: iso };
}

export function waitPatch(): TaskPatch {
  return { status: 'waiting', is_focus: false };
}

export function delegatePatch(name: string): TaskPatch {
  return { status: 'waiting', delegated_to: name.trim(), is_focus: false };
}

/** Stop, but keep: back to Planned and off today's plan. */
export function pausePatch(): TaskPatch {
  return { status: 'planned', scheduled_date: null, is_focus: false };
}

/** What dropping a card into a Kanban column means for the task. */
export function statusPatch(task: Task, to: TaskStatus, now: Date): TaskPatch {
  if (to === 'done') return completePatch(now);
  if (task.status === 'done') return reopenPatch(to, now);
  if (to === 'backlog') return backlogPatch(now);
  return { status: to, is_focus: to === 'inbox' ? false : task.is_focus };
}
