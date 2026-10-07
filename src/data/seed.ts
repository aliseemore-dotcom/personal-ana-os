import type { InboxItem, Person, Project, Task, TaskEvent } from '../domain/types';
import { addDays, dateKey, endOfDay } from '../domain/dates';
import { newTask } from '../logic/taskFactory';

/** Demo data for the local store, built relative to "now" so every state is visible on both pages. */
export function buildSeed(now: Date): { tasks: Task[]; projects: Project[]; people: Person[]; events: TaskEvent[]; inbox: InboxItem[] } {
  const projects: Project[] = [
    { id: 'p-watford', name: 'Watford', goal_id: null },
    { id: 'p-zurich', name: 'Zurich', goal_id: null },
    { id: 'p-cbre', name: 'CBRE', goal_id: null },
    { id: 'p-brokerage', name: 'Brokerage', goal_id: null },
    { id: 'p-ops', name: 'Operations', goal_id: null },
  ];
  const people: Person[] = [
    { id: 'u-marc', name: 'Marc' },
    { id: 'u-elena', name: 'Elena' },
  ];
  const ago = (d: number, h = 10) => {
    const x = addDays(now, -d);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const today = dateKey(now);
  let i = 0;
  const t = (over: Partial<Task> & Pick<Task, 'title'>): Task =>
    newTask(
      {
        id: `seed-${++i}`,
        status: 'planned',
        scheduled_date: today,
        estimated_duration: 45,
        created_at: ago(14),
        updated_at: ago(1),
        last_activity_at: ago(1),
        source: 'seed',
        ...over,
      },
      now,
    );

  const tasks: Task[] = [
    // Today
    t({ title: 'Send Watford investor brief', project_id: 'p-watford', priority: 'high', impact_score: 9, blocks_others: true, blocks_note: 'Investor waiting', deadline: endOfDay(now).toISOString(), estimated_duration: 90, status: 'in_progress', last_activity_at: ago(0, 8), description: 'Final numbers from the model, one-page summary, cover note.' }),
    t({ title: 'Review Zurich ventilation requirements', project_id: 'p-zurich', priority: 'high', impact_score: 7, estimated_duration: 60 }),
    t({ title: 'Prepare agenda for CBRE follow-up', project_id: 'p-cbre', impact_score: 6, estimated_duration: 30 }),
    t({ title: 'Update the partner pipeline sheet', project_id: 'p-ops', priority: 'low', impact_score: 4, estimated_duration: 40 }),
    t({ title: 'Reply to Marc about site visit', estimated_duration: 5, project_id: 'p-zurich' }),
    t({ title: 'Approve the March invoice', priority: 'low', estimated_duration: 10, project_id: 'p-ops', reschedule_count: 4 }),
    t({ title: 'Book flights for the Zurich trip', priority: 'low', estimated_duration: 15, project_id: 'p-zurich' }),
    // Overdue
    t({ title: 'Sign the NDA for the Berlin partner', deadline: ago(3, 18), scheduled_date: dateKey(addDays(now, -3)), estimated_duration: 20, project_id: 'p-brokerage' }),
    t({ title: 'Send revised fee proposal', project_id: 'p-cbre', priority: 'high', deadline: ago(1, 17), scheduled_date: dateKey(addDays(now, -1)), impact_score: 6, estimated_duration: 60, reschedule_count: 3 }),
    // In progress (6: over the limit of 5)
    t({ title: 'Draft the Q4 positioning note', status: 'in_progress', scheduled_date: null, last_activity_at: ago(7), impact_score: 6 }),
    t({ title: 'Negotiate CBRE fee structure', status: 'in_progress', scheduled_date: null, project_id: 'p-cbre', priority: 'high', last_activity_at: ago(1) }),
    t({ title: 'Model Zurich yield scenarios', status: 'in_progress', scheduled_date: null, project_id: 'p-zurich', last_activity_at: ago(2) }),
    t({ title: 'Update the investor FAQ', status: 'in_progress', scheduled_date: null, project_id: 'p-watford', priority: 'low', last_activity_at: ago(3) }),
    t({ title: 'Prepare board materials', status: 'in_progress', scheduled_date: null, project_id: 'p-ops', priority: 'high', deadline: endOfDay(addDays(now, 4)).toISOString(), last_activity_at: ago(0, 9) }),
    // Waiting
    t({ title: 'Zurich landlord follow-up', status: 'waiting', scheduled_date: null, project_id: 'p-zurich', last_activity_at: ago(11), waiting_since: ago(11) }),
    t({ title: 'Legal comments on the term sheet', status: 'waiting', scheduled_date: null, project_id: 'p-watford', last_activity_at: ago(10), waiting_since: ago(10) }),
    t({ title: 'Architect drawings', status: 'waiting', scheduled_date: null, project_id: 'p-zurich', delegated_to: 'Elena', assigned_person_id: 'u-elena', last_activity_at: ago(2), waiting_since: ago(2) }),
    // Planned
    t({ title: 'Quarterly review with the board', scheduled_date: dateKey(addDays(now, 5)), estimated_duration: 120, impact_score: 8, project_id: 'p-ops', priority: 'high' }),
    t({ title: 'Brokerage fee benchmark', scheduled_date: dateKey(addDays(now, 2)), project_id: 'p-brokerage', deadline: endOfDay(addDays(now, 6)).toISOString() }),
    t({ title: 'Think about hiring an analyst', scheduled_date: null, project_id: null, created_at: ago(12) }),
    // Backlog
    t({ title: 'Prepare Milan location comparison', status: 'backlog', scheduled_date: null, backlog_since: ago(37), last_activity_at: ago(37), created_at: ago(50), project_id: 'p-brokerage' }),
    t({ title: 'Redesign the investor one-pager', status: 'backlog', scheduled_date: null, backlog_since: ago(46), last_activity_at: ago(46), created_at: ago(60), project_id: 'p-watford' }),
    t({ title: 'Look into a CRM migration', status: 'backlog', scheduled_date: null, backlog_since: ago(38), last_activity_at: ago(38), created_at: ago(50) }),
    t({ title: 'Explore a podcast series', status: 'backlog', scheduled_date: null, backlog_since: ago(4), last_activity_at: ago(4), created_at: ago(6) }),
    // Inbox
    t({ title: 'Check the Brokerage fee template', status: 'inbox', scheduled_date: null, created_at: ago(5), last_activity_at: ago(5), estimated_duration: null }),
    // Done
    t({ title: 'Send last week’s summary', status: 'done', completed_at: ago(0, 9), last_activity_at: ago(0, 9) }),
    t({ title: 'Confirm the Zurich site visit', status: 'done', completed_at: ago(2, 15), last_activity_at: ago(2, 15), project_id: 'p-zurich' }),
    t({ title: 'Share the CBRE deck', status: 'done', completed_at: ago(4, 11), last_activity_at: ago(4, 11), project_id: 'p-cbre' }),
  ];

  const inbox: InboxItem[] = [
    { id: 'cap-1', content: 'Ask the notary about the Zurich contract timeline', created_at: ago(6, 12), status: 'inbox' },
    { id: 'cap-2', content: 'Call Marc about Zurich ventilation requirements', created_at: ago(0, 8), status: 'inbox' },
  ];

  const events: TaskEvent[] = [
    { id: 'ev-1', task_id: 'seed-9', type: 'rescheduled', at: ago(5), from: dateKey(addDays(now, -6)), to: dateKey(addDays(now, -5)) },
    { id: 'ev-2', task_id: 'seed-9', type: 'rescheduled', at: ago(3), from: dateKey(addDays(now, -5)), to: dateKey(addDays(now, -3)) },
    { id: 'ev-3', task_id: 'seed-9', type: 'rescheduled', at: ago(1), from: dateKey(addDays(now, -3)), to: dateKey(addDays(now, -1)) },
  ];

  return { tasks, projects, people, events, inbox };
}
