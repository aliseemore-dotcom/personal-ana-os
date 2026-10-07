import type { Project, Task } from '../domain/types';
import { addDays, dateKey, endOfDay } from '../domain/dates';

/** Demo data for the local store, built relative to "now" so every Today state is visible. */
export function buildSeed(now: Date): { tasks: Task[]; projects: Project[] } {
  const projects: Project[] = [
    { id: 'p-watford', name: 'Watford', goal_id: null },
    { id: 'p-zurich', name: 'Zurich', goal_id: null },
    { id: 'p-cbre', name: 'CBRE', goal_id: null },
    { id: 'p-ops', name: 'Operations', goal_id: null },
  ];
  const ago = (d: number, h = 10) => {
    const x = addDays(now, -d);
    x.setHours(h, 0, 0, 0);
    return x.toISOString();
  };
  const today = dateKey(now);
  let i = 0;
  const t = (over: Partial<Task> & Pick<Task, 'title'>): Task => ({
    id: `seed-${++i}`,
    description: null,
    status: 'planned',
    priority: 'medium',
    deadline: null,
    scheduled_date: today,
    estimated_duration: 45,
    project_id: null,
    created_at: ago(10),
    updated_at: ago(1),
    last_activity_at: ago(1),
    completed_at: null,
    impact_score: 5,
    blocks_others: false,
    blocks_note: null,
    is_focus: false,
    source: 'seed',
    ...over,
  });

  const tasks: Task[] = [
    t({ title: 'Send Watford investor brief', project_id: 'p-watford', priority: 'high', impact_score: 9, blocks_others: true, blocks_note: 'Investor waiting', deadline: endOfDay(now).toISOString(), estimated_duration: 90, status: 'in_progress', last_activity_at: ago(0, 8), description: 'Final numbers from the model, one-page summary, cover note.' }),
    t({ title: 'Review Zurich ventilation requirements', project_id: 'p-zurich', priority: 'high', impact_score: 7, estimated_duration: 60 }),
    t({ title: 'Prepare agenda for CBRE follow-up', project_id: 'p-cbre', priority: 'medium', impact_score: 6, estimated_duration: 30 }),
    t({ title: 'Update the partner pipeline sheet', project_id: 'p-ops', priority: 'low', impact_score: 4, estimated_duration: 40 }),
    t({ title: 'Reply to Marc about site visit', priority: 'medium', estimated_duration: 5, project_id: 'p-zurich' }),
    t({ title: 'Approve the March invoice', priority: 'low', estimated_duration: 10, project_id: 'p-ops' }),
    t({ title: 'Book flights for the Zurich trip', priority: 'low', estimated_duration: 15, project_id: 'p-zurich' }),
    // Attention: overdue
    t({ title: 'Sign the NDA for the Berlin partner', priority: 'medium', deadline: ago(3, 18), scheduled_date: dateKey(addDays(now, -3)), estimated_duration: 20, impact_score: 5 }),
    t({ title: 'Send revised fee proposal', project_id: 'p-cbre', priority: 'high', deadline: ago(1, 17), scheduled_date: dateKey(addDays(now, -1)), estimated_duration: 60, impact_score: 6 }),
    // Attention: waiting too long
    t({ title: 'Legal comments on the term sheet', status: 'waiting', scheduled_date: null, project_id: 'p-watford', last_activity_at: ago(10) }),
    // Attention: lost attention
    t({ title: 'Draft the Q4 positioning note', status: 'in_progress', scheduled_date: null, last_activity_at: ago(7), impact_score: 6 }),
    // Attention: stale backlog
    t({ title: 'Redesign the investor one-pager', status: 'backlog', scheduled_date: null, last_activity_at: ago(46), created_at: ago(60) }),
    t({ title: 'Look into a CRM migration', status: 'backlog', scheduled_date: null, last_activity_at: ago(38), created_at: ago(50) }),
    // Not for today
    t({ title: 'Quarterly review with the board', scheduled_date: dateKey(addDays(now, 5)), estimated_duration: 120, impact_score: 8 }),
    t({ title: 'Explore a podcast series', status: 'backlog', scheduled_date: null, last_activity_at: ago(4), created_at: ago(6) }),
    t({ title: 'Send last week’s summary', status: 'done', completed_at: ago(0, 9), last_activity_at: ago(0, 9) }),
  ];
  return { tasks, projects };
}
