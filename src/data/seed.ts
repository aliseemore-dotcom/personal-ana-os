import type {
  InboxItem, Person, Project, ProjectDecision, ProjectEvent, ProjectPerson, Task, TaskEvent, Workstream,
} from '../domain/types';
import { newProject, newWorkstream } from '../logic/projectFactory';
import { addDays, dateKey, endOfDay } from '../domain/dates';
import { newTask } from '../logic/taskFactory';

/** Demo data for the local store, built relative to "now" so every state is visible on both pages. */
export interface Seed {
  tasks: Task[];
  projects: Project[];
  people: Person[];
  events: TaskEvent[];
  inbox: InboxItem[];
  workstreams: Workstream[];
  decisions: ProjectDecision[];
  notes: [];
  documents: [];
  projectPeople: ProjectPerson[];
  projectEvents: ProjectEvent[];
}

export function buildSeed(now: Date): Seed {
  const born = (days: number) => {
    const x = addDays(now, -days);
    x.setHours(9, 0, 0, 0);
    return x;
  };
  const project = (o: Parameters<typeof newProject>[0]) => newProject({ last_activity_at: born(2).toISOString(), ...o }, born(30));
  const projects: Project[] = [
    project({ id: 'pr-kofman', name: 'Kofman + Partners', category: 'work', summary: 'Primary work area. Holds the tasks, responsibilities, contacts, notes, documents and active work of the main professional role.' }),
    project({
      id: 'pr-pipeline', name: 'Hotel & Investment Pipeline', category: 'work', workstream_kind: 'opportunity',
      summary: 'Central container for investment opportunities and deals. Active and potential opportunities are tracked here as records, not as separate top-level projects.',
      objective: 'Progress qualified buyers for investment opportunities.',
      status_note: 'Watford materials being prepared. Several hotel opportunities remain in follow-up.',
      next_action: 'Finalise Watford investor brief.', blocker: 'Pricing/positioning requires confirmation.', next_milestone: 'Investor outreach.',
    }),
    project({
      id: 'pr-restaurant', name: 'Restaurant Expansion', category: 'work', workstream_kind: 'location', status: 'waiting',
      summary: 'Central project for international restaurant expansion. Zurich and Milan are the first workstreams; further markets can be added as they open.',
      blocker: 'Waiting for client feedback.',
    }),
    project({ id: 'pr-neosoul', name: 'NeoSoul', category: 'business', summary: 'One project for NeoSoul. Product, Telegram MVP, Pearl Journal, website and branding, content and books are workstreams inside it.' }),
    project({ id: 'pr-blackbook', name: 'BLACKBOOK', category: 'business', summary: 'Matchmaking business. May hold the business model, client and candidate pipelines, process, CRM, fee structure, questionnaires, NDAs, product, branding and technology.' }),
    project({ id: 'pr-citizenship', name: 'British Citizenship', category: 'personal', summary: 'Central project for citizenship work: documents, application, referee, evidence, ceremony, and the related tasks and deadlines.' }),
    project({ id: 'pr-travel', name: 'Travel & Holidays', category: 'personal', workstream_kind: 'trip', summary: 'Permanent travel container. Each trip is a record inside it, and completed trips stay available in the history.' }),
    project({ id: 'pr-finance', name: 'Financial Plan', category: 'personal', summary: 'Personal financial planning: income, recurring expenses, debt reduction, savings, planned large expenses and goals. Container only for now.' }),
    project({ id: 'pr-home', name: 'Home & Property', category: 'personal', summary: 'Central project for the home and property: maintenance, repairs, insurance, property issues, household administration, documents and tasks.' }),
  ];
  const ws = (project_id: string, name: string, type: Workstream['type'], extra: Partial<Workstream> = {}) =>
    newWorkstream({ id: `ws-${project_id.slice(3)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, project_id, name, type, created_at: born(30).toISOString(), last_activity_at: born(2).toISOString(), ...extra }, born(30));
  const workstreams: Workstream[] = [
    ...['Watford FC', 'Italian Football Club', 'Cannes Hotel', 'Austria Hotels', 'Phuket / Natai', 'Paul Ricard / F1', 'UAE Hotel Opportunities', 'Madrid Opportunities', 'UK Portfolio Opportunities'].map((n) =>
      ws('pr-pipeline', n, 'opportunity', n === 'Watford FC' ? { last_activity_at: born(0).toISOString() } : {}),
    ),
    ws('pr-restaurant', 'Zurich', 'location'),
    ws('pr-restaurant', 'Milan', 'location'),
    ...['Product', 'Telegram MVP', 'Pearl Journal', 'Website & Branding', 'Content', 'Books'].map((n) => ws('pr-neosoul', n, 'workstream')),
    ws('pr-travel', 'Ibiza', 'trip', { metadata: { start_date: '2026-10-15', end_date: '2026-10-19' }, last_activity_at: born(0).toISOString() }),
  ];
  const wsId = (name: string) => workstreams.find((w) => w.name === name)!.id;
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
    t({ title: 'Send Watford investor brief', project_id: 'pr-pipeline', workstream_id: wsId('Watford FC'), priority: 'high', impact_score: 9, blocks_others: true, blocks_note: 'Investor waiting', deadline: endOfDay(now).toISOString(), estimated_duration: 90, status: 'in_progress', last_activity_at: ago(0, 8), description: 'Final numbers from the model, one-page summary, cover note.' }),
    t({ title: 'Review Zurich ventilation requirements', project_id: 'pr-restaurant', workstream_id: wsId('Zurich'), priority: 'high', impact_score: 7, estimated_duration: 60 }),
    t({ title: 'Prepare agenda for CBRE follow-up', project_id: 'pr-kofman', impact_score: 6, estimated_duration: 30 }),
    t({ title: 'Update the partner pipeline sheet', project_id: 'pr-kofman', priority: 'low', impact_score: 4, estimated_duration: 40 }),
    t({ title: 'Reply to Marc about site visit', estimated_duration: 5, project_id: 'pr-restaurant' }),
    t({ title: 'Approve the March invoice', priority: 'low', estimated_duration: 10, project_id: 'pr-kofman', reschedule_count: 4 }),
    t({ title: 'Book flights for the Zurich trip', priority: 'low', estimated_duration: 15, project_id: 'pr-restaurant' }),
    // Overdue
    t({ title: 'Sign the NDA for the Berlin partner', deadline: ago(3, 18), scheduled_date: dateKey(addDays(now, -3)), estimated_duration: 20, project_id: 'pr-kofman' }),
    t({ title: 'Send revised fee proposal', project_id: 'pr-kofman', priority: 'high', deadline: ago(1, 17), scheduled_date: dateKey(addDays(now, -1)), impact_score: 6, estimated_duration: 60, reschedule_count: 3 }),
    // In progress (6: over the limit of 5)
    t({ title: 'Draft the Q4 positioning note', status: 'in_progress', scheduled_date: null, last_activity_at: ago(7), impact_score: 6 }),
    t({ title: 'Negotiate CBRE fee structure', status: 'in_progress', scheduled_date: null, project_id: 'pr-kofman', priority: 'high', last_activity_at: ago(1) }),
    t({ title: 'Model Zurich yield scenarios', status: 'in_progress', scheduled_date: null, project_id: 'pr-restaurant', workstream_id: wsId('Zurich'), last_activity_at: ago(2) }),
    t({ title: 'Update the investor FAQ', status: 'in_progress', scheduled_date: null, project_id: 'pr-pipeline', priority: 'low', last_activity_at: ago(3) }),
    t({ title: 'Prepare board materials', status: 'in_progress', scheduled_date: null, project_id: 'pr-kofman', priority: 'high', deadline: endOfDay(addDays(now, 4)).toISOString(), last_activity_at: ago(0, 9) }),
    // Waiting
    t({ title: 'Zurich landlord follow-up', status: 'waiting', scheduled_date: null, project_id: 'pr-restaurant', workstream_id: wsId('Zurich'), last_activity_at: ago(11), waiting_since: ago(11) }),
    t({ title: 'Legal comments on the term sheet', status: 'waiting', scheduled_date: null, project_id: 'pr-pipeline', last_activity_at: ago(10), waiting_since: ago(10) }),
    t({ title: 'Architect drawings', status: 'waiting', scheduled_date: null, project_id: 'pr-restaurant', workstream_id: wsId('Zurich'), delegated_to: 'Elena', assigned_person_id: 'u-elena', last_activity_at: ago(2), waiting_since: ago(2) }),
    // Planned
    t({ title: 'Quarterly review with the board', scheduled_date: dateKey(addDays(now, 5)), estimated_duration: 120, impact_score: 8, project_id: 'pr-kofman', priority: 'high' }),
    t({ title: 'Brokerage fee benchmark', scheduled_date: dateKey(addDays(now, 2)), project_id: 'pr-kofman', deadline: endOfDay(addDays(now, 6)).toISOString() }),
    t({ title: 'Think about hiring an analyst', scheduled_date: null, project_id: null, created_at: ago(12) }),
    // Backlog
    t({ title: 'Prepare Milan location comparison', status: 'backlog', scheduled_date: null, backlog_since: ago(37), last_activity_at: ago(37), created_at: ago(50), project_id: 'pr-restaurant', workstream_id: wsId('Milan') }),
    t({ title: 'Redesign the investor one-pager', status: 'backlog', scheduled_date: null, backlog_since: ago(46), last_activity_at: ago(46), created_at: ago(60), project_id: 'pr-pipeline' }),
    t({ title: 'Look into a CRM migration', status: 'backlog', scheduled_date: null, backlog_since: ago(38), last_activity_at: ago(38), created_at: ago(50) }),
    t({ title: 'Explore a podcast series', status: 'backlog', scheduled_date: null, backlog_since: ago(4), last_activity_at: ago(4), created_at: ago(6) }),
    // Inbox
    t({ title: 'Check the Brokerage fee template', status: 'inbox', scheduled_date: null, created_at: ago(5), last_activity_at: ago(5), estimated_duration: null }),
    // Done
    t({ title: 'Send last week’s summary', status: 'done', completed_at: ago(0, 9), last_activity_at: ago(0, 9) }),
    t({ title: 'Confirm the Zurich site visit', status: 'done', completed_at: ago(2, 15), last_activity_at: ago(2, 15), project_id: 'pr-restaurant' }),
    t({ title: 'Share the CBRE deck', status: 'done', completed_at: ago(4, 11), last_activity_at: ago(4, 11), project_id: 'pr-kofman' }),
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

  const decisions: ProjectDecision[] = [
    {
      id: 'dec-1', project_id: 'pr-pipeline', workstream_id: wsId('Watford FC'), date: '2026-10-06', people_ids: [], created_at: new Date(2026, 9, 6, 12).toISOString(),
      decision: 'Position Watford negotiations from approximately £90m rather than presenting the maximum valuation as the opening price.',
      context: 'Maintain negotiation flexibility while preserving investment upside.',
    },
  ];
  const projectPeople: ProjectPerson[] = [
    { id: 'pp-1', project_id: 'pr-restaurant', workstream_id: wsId('Zurich'), person_id: 'u-marc', role: null, relationship: 'Contact for Zurich', last_interaction: null, next_action: 'Call about ventilation requirements' },
    { id: 'pp-2', project_id: 'pr-restaurant', workstream_id: wsId('Zurich'), person_id: 'u-elena', role: null, relationship: 'Architect drawings', last_interaction: null, next_action: null },
  ];
  const projectEvents: ProjectEvent[] = [
    ...projects.map<ProjectEvent>((p) => ({ id: `pe-${p.id}`, project_id: p.id, workstream_id: null, type: 'project_created', at: p.created_at, title: p.name, ref_id: null })),
    ...workstreams.map<ProjectEvent>((w) => ({ id: `pw-${w.id}`, project_id: w.project_id, workstream_id: w.id, type: 'workstream_added', at: w.created_at, title: w.name, ref_id: w.id })),
    { id: 'pe-dec-1', project_id: 'pr-pipeline', workstream_id: wsId('Watford FC'), type: 'decision_recorded', at: decisions[0].created_at, title: decisions[0].decision, ref_id: 'dec-1' },
  ];

  return { tasks, projects, people, events, inbox, workstreams, decisions, notes: [], documents: [], projectPeople, projectEvents };
}
