import { dateKey } from '../domain/dates';
import type { InboxItem, Task } from '../domain/types';
import type { DecisionAction } from '../logic/decisions';
import { useTasks } from './TasksProvider';

export type DecisionTarget = { id: string; task?: Task; capture?: InboxItem };
export type DecisionArg = Date | string | undefined;

/**
 * One place that says what each decision does, for tasks and for raw captures,
 * shared by "Needs decision" and "Weekly cleanup".
 */
export function useDecisionActions() {
  const api = useTasks();
  return (target: DecisionTarget, action: DecisionAction, arg?: DecisionArg) => {
    const { id } = target;
    if (target.capture) {
      const to = (patch: Partial<Task>) => api.promoteCapture(id, patch);
      switch (action) {
        case 'do': return to({ status: 'planned', scheduled_date: dateKey(new Date()) });
        case 'schedule': return to({ status: 'planned', scheduled_date: dateKey(arg as Date) });
        case 'delegate': return to({ status: 'waiting', delegated_to: String(arg).trim() });
        case 'wait': return to({ status: 'waiting' });
        case 'backlog':
        case 'keep': return to({ status: 'backlog' });
        case 'drop': return api.dropCapture(id);
        default: return;
      }
    }
    switch (action) {
      case 'do': return api.scheduleToday(id);
      case 'schedule': return api.reschedule(id, arg as Date);
      case 'delegate': return api.delegate(id, String(arg));
      case 'wait': return api.wait(id);
      case 'follow_up': return api.followUp(id);
      case 'keep_waiting':
      case 'keep': return api.review(id);
      case 'backlog': return api.moveToBacklog(id);
      case 'drop': return api.remove(id);
    }
  };
}
