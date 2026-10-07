import type { Task, TaskEvent, TaskEventType, TaskPatch } from '../domain/types';
import { dateKey } from '../domain/dates';

export type NewEvent = Pick<TaskEvent, 'type' | 'at' | 'from' | 'to'>;

/**
 * Every task change flows through here. It adds the derived bookkeeping fields
 * (waiting_since, backlog_since, reschedule_count, last_activity_at) and the
 * history events, so TODAY and TASKS can never disagree about what happened.
 */
export function applyChange(before: Task, patch: TaskPatch, now: Date): { patch: TaskPatch; events: NewEvent[] } {
  const at = now.toISOString();
  const out: TaskPatch = { ...patch };
  const events: NewEvent[] = [];
  const ev = (type: TaskEventType, from: string | null, to: string | null) => events.push({ type, at, from, to });

  if (out.last_activity_at === undefined) out.last_activity_at = at;

  if (patch.status !== undefined && patch.status !== before.status) {
    if (patch.status === 'done') ev('completed', before.status, 'done');
    else if (before.status === 'done') ev('reopened', 'done', patch.status);
    else ev('status_changed', before.status, patch.status);
    out.waiting_since = patch.status === 'waiting' ? at : null;
    out.backlog_since = patch.status === 'backlog' ? at : null;
  }

  if (patch.deadline !== undefined && patch.deadline !== before.deadline) {
    ev('deadline_changed', before.deadline, patch.deadline);
  }

  if (patch.scheduled_date !== undefined && patch.scheduled_date !== before.scheduled_date && patch.scheduled_date) {
    const was = before.scheduled_date;
    const to = patch.scheduled_date;
    const postponed = was !== null && to > was;
    if (postponed) {
      out.reschedule_count = before.reschedule_count + 1;
      ev('rescheduled', was, to);
    } else if (to === dateKey(now)) ev('moved_to_today', was, to);
    else ev(was === null ? 'scheduled' : 'rescheduled', was, to);
  }

  if (patch.delegated_to && patch.delegated_to !== before.delegated_to) ev('delegated', before.delegated_to, patch.delegated_to);
  if (patch.priority !== undefined && patch.priority !== before.priority) ev('priority_changed', before.priority, patch.priority);
  if (patch.last_reviewed_at && patch.last_reviewed_at !== before.last_reviewed_at) ev('reviewed', null, null);

  return { patch: out, events };
}
