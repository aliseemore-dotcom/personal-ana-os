import type { Task } from '../domain/types';

export const inProgress = (tasks: Task[]) => tasks.filter((t) => t.status === 'in_progress');

/** True when starting one more task would exceed the recommended limit. */
export function wouldOverload(tasks: Task[], limit: number, movingId?: string): boolean {
  return inProgress(tasks).filter((t) => t.id !== movingId).length >= limit;
}
