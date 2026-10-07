import type { Task } from '../domain/types';
import { calendarDaysBetween } from '../domain/dates';

/** Machine-readable reasons; the UI turns these into words. Nothing is opaque. */
export type Reason =
  | { code: 'overdue'; days: number }
  | { code: 'due_today' }
  | { code: 'due_soon'; days: number }
  | { code: 'blocks_others'; note: string | null }
  | { code: 'high_impact' }
  | { code: 'high_priority' }
  | { code: 'momentum' }
  | { code: 'quick_win'; minutes: number };

export interface Scored {
  task: Task;
  score: number;
  reasons: Reason[];
}

/**
 * v1 scoring: deterministic and additive so every point can be explained.
 * Inputs: deadline urgency, impact, blocking, priority, momentum, overdue.
 */
export function scoreTask(task: Task, now: Date): Scored {
  let score = 0;
  const reasons: Reason[] = [];

  if (task.deadline) {
    const deadline = new Date(task.deadline);
    if (deadline.getTime() < now.getTime()) {
      const days = Math.max(1, calendarDaysBetween(deadline, now));
      score += 45 + Math.min(days, 10);
      reasons.push({ code: 'overdue', days });
    } else {
      const days = calendarDaysBetween(now, deadline);
      if (days === 0) {
        score += 35;
        reasons.push({ code: 'due_today' });
      } else if (days <= 3) {
        score += 18 - days * 3;
        reasons.push({ code: 'due_soon', days });
      }
    }
  }

  if (task.blocks_others) {
    score += 25;
    reasons.push({ code: 'blocks_others', note: task.blocks_note });
  }

  score += task.impact_score * 3;
  if (task.impact_score >= 8) reasons.push({ code: 'high_impact' });

  if (task.priority === 'high') {
    score += 15;
    reasons.push({ code: 'high_priority' });
  } else if (task.priority === 'medium') {
    score += 6;
  }

  if (task.status === 'in_progress') {
    const idle = calendarDaysBetween(new Date(task.last_activity_at), now);
    if (idle <= 2) {
      score += 8;
      reasons.push({ code: 'momentum' });
    }
  }

  return { task, score, reasons };
}

export function rankTasks(tasks: Task[], now: Date): Scored[] {
  return tasks
    .map((t) => scoreTask(t, now))
    .sort((a, b) => b.score - a.score || a.task.created_at.localeCompare(b.task.created_at));
}
