import type { AttentionItem } from './logic/attention';
import type { Reason } from './logic/prioritisation';
import type { Priority, TaskEvent, TaskStatus } from './domain/types';
import type { DecisionAction, DecisionKind } from './logic/decisions';
import type { CleanupKind } from './logic/cleanup';
import type { Observation, RecommendationCode } from './logic/summary';
import { config } from './config';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString(config.locale, { day: 'numeric', month: 'short' });
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(config.locale, { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * All user-facing copy lives here so the interface can be translated later
 * (the Rose Glass brand book writes UI copy in Russian; a `ru` set can drop in).
 * Sentence case throughout, per the brand: no capitals-only labels.
 */
export const t = {
  greeting: (hour: number, name: string) =>
    `${hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, ${name}.`,

  focus: {
    label: 'Focus of the day',
    why: 'Why this matters',
    suggested: 'Suggested for you',
    chosen: 'Chosen by you',
    complete: 'Complete',
    changeFocus: 'Change focus',
    reschedule: 'Reschedule',
    completed: 'Completed',
    undo: 'Undo',
    pickTitle: 'Choose today’s focus',
    empty: 'Nothing is planned for today. Capture something, or pick a task from the backlog.',
    emptyDone: 'Everything planned is done. Enjoy the quiet.',
  },

  tasks: {
    title: 'Today',
    priority: 'Priority',
    quick: 'Quick tasks',
    more: (n: number) => `${n} more planned for today`,
    fewer: 'Show fewer',
    doneToday: (n: number) => `${n} done today`,
    empty: 'No other tasks today.',
    complete: 'Complete',
    reschedule: 'Reschedule',
    changePriority: 'Change priority',
    open: 'Open task',
    undo: 'Undo',
  },

  priorities: { high: 'High', medium: 'Medium', low: 'Low' } as Record<Priority, string>,

  reschedule: {
    tomorrow: 'Tomorrow',
    inTwoDays: 'In two days',
    nextMonday: 'Next Monday',
    pick: 'Pick a date',
    apply: 'Set date',
  },

  comingUp: {
    title: 'Coming up',
    now: 'Now',
    empty: (hours: number) => `Nothing in the next ${hours} hours.`,
    error: 'Calendar is unavailable right now.',
    inMinutes: (m: number) => (m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`),
  },

  attention: {
    title: 'Attention needed',
    clear: 'Nothing is slipping. All clear.',
    groups: { overdue: 'Overdue', waiting: 'Waiting', forgotten: 'Forgotten' },
    groupHint: {
      overdue: 'Deadline passed, not done.',
      waiting: 'Waiting for about a working week without a follow-up.',
      forgotten: 'In progress with no activity, or in the backlog for a month.',
    },
    detail: (it: AttentionItem) => {
      const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
      switch (it.kind) {
        case 'overdue':
          return `${plural(it.days, 'day')} overdue`;
        case 'waiting':
          return `Waiting ${plural(it.days, 'working day')}`;
        case 'lost_attention':
          return `In progress, no activity for ${plural(it.days, 'day')}`;
        case 'stale_backlog':
          return `In the backlog for ${plural(it.days, 'day')}`;
      }
    },
    actions: { do: 'Do', reschedule: 'Reschedule', backlog: 'Move to backlog', keep: 'Keep in backlog', delete: 'Delete' },
    confirmDelete: 'Delete for good?',
    yes: 'Delete',
    no: 'Cancel',
  },

  question: {
    title: 'Daily question',
    placeholder: 'Write a line or two…',
    save: 'Save',
    saved: 'Saved',
    edited: 'Unsaved',
  },

  capture: {
    open: 'Quick capture',
    title: 'Capture',
    placeholder: 'Call Marc about Zurich ventilation requirements',
    hint: 'Goes to your inbox. Sort it later.',
    save: 'Save to inbox',
    saved: 'Saved to inbox',
    close: 'Close',
  },

  dialog: {
    title: 'Task',
    name: 'Title',
    description: 'Notes',
    status: 'Status',
    priority: 'Priority',
    deadline: 'Deadline',
    scheduled: 'Planned for',
    duration: 'Minutes',
    impact: 'Impact (1–10)',
    blocks: 'Blocks someone or something',
    blocksNote: 'Who or what',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
  },

  statuses: {
    inbox: 'Inbox',
    backlog: 'Backlog',
    planned: 'Planned',
    in_progress: 'In progress',
    waiting: 'Waiting',
    done: 'Done',
  } as const,

  overdueTag: (days: number) => `${days} day${days === 1 ? '' : 's'} overdue`,
  dueToday: 'Due today',
  minutes: (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`),

  reason: (r: Reason): string => {
    switch (r.code) {
      case 'overdue':
        return `Overdue by ${r.days} day${r.days === 1 ? '' : 's'}`;
      case 'due_today':
        return 'Due today';
      case 'due_soon':
        return `Due in ${r.days} day${r.days === 1 ? '' : 's'}`;
      case 'blocks_others':
        return r.note ?? 'Blocks other work';
      case 'high_impact':
        return 'High impact';
      case 'high_priority':
        return 'High priority';
      case 'momentum':
        return 'Already moving';
      case 'quick_win':
        return `Quick win · ${r.minutes} min`;
    }
  },

  auth: {
    title: 'Sign in',
    body: 'Your data is private to you. We’ll email you a link.',
    email: 'Email address',
    send: 'Send link',
    sent: 'Check your inbox for the sign-in link.',
    signOut: 'Sign out',
  },

  demo: 'Demo data on this device',
  fmtDate: fmt,
  loading: 'Loading your day…',
  errors: {
    load: 'Could not load your tasks.',
    save: 'That change did not save — it has been undone.',
  },

  nav: { today: 'Today', tasks: 'Tasks', label: 'Pages' },

  tasksPage: {
    title: 'Tasks',
    subtitle: 'What needs action, a decision or clarification.',
    summary: 'Assistant summary',
    recommended: 'Recommended action',
    calm: 'Your workload looks controlled. Nothing needs a decision right now.',
    active: (n: number) => `You currently have ${plural(n, 'active task')}.`,
    observation: (o: Observation): string => {
      switch (o.code) {
        case 'wip':
          return `Your In progress list is overloaded with ${o.n} tasks (recommended maximum ${o.extra}).`;
        case 'overdue':
          return o.extra
            ? `${plural(o.n, 'task is', 'tasks are')} overdue. ${o.extra === 1 ? 'One has' : `${o.extra} have`} already been rescheduled several times.`
            : `${plural(o.n, 'task is', 'tasks are')} overdue.`;
        case 'waiting':
          return `${plural(o.n, 'follow-up')} appear${o.n === 1 ? 's' : ''} overdue.`;
        case 'stale':
          return `${plural(o.n, 'task has', 'tasks have')} not moved for more than a week.`;
        case 'inbox':
          return `${plural(o.n, 'Inbox item')} ${o.n === 1 ? 'has' : 'have'} not been reviewed.`;
        case 'backlog':
          return `The backlog has grown to ${o.n} tasks.`;
        case 'no_project':
          return `${plural(o.n, 'active task')} ${o.n === 1 ? 'has' : 'have'} no project.`;
        case 'no_deadline':
          return `${o.n} active tasks have no deadline.`;
      }
    },
    recommendation: (c: RecommendationCode): string =>
      ({
        reduce_wip_review_waiting: 'Review Waiting and reduce In progress before starting additional work.',
        reduce_wip: 'Reduce In progress before starting additional work.',
        decide_overdue: 'Decide whether the overdue tasks still belong in active work.',
        follow_up_waiting: 'Follow up on the waiting tasks, or release them.',
        review_stale: 'Look at the tasks that have not moved and decide which ones continue.',
        process_inbox: 'Process the Inbox so nothing gets lost.',
        trim_backlog: 'Run Weekly cleanup to bring the backlog down.',
        assign_projects: 'Assign projects so the work can be grouped.',
        set_deadlines: 'Give the important tasks a deadline.',
      })[c],
  },

  decision: {
    title: 'Needs decision',
    none: 'Nothing needs a decision right now.',
    lead: (l: { total: number; overdue: number; overdueRepeated: number; waiting: number; other: number }): string => {
      const parts: string[] = [];
      if (l.overdue) {
        parts.push(
          l.overdueRepeated
            ? `${plural(l.overdue, 'task is', 'tasks are')} overdue. ${l.overdueRepeated === 1 ? 'One has' : `${l.overdueRepeated} have`} already been rescheduled several times. Decide whether ${l.overdueRepeated === 1 ? 'it still belongs' : 'they still belong'} in active work.`
            : `${plural(l.overdue, 'task is', 'tasks are')} overdue. Decide what happens to each.`,
        );
      }
      if (l.waiting) parts.push(`${plural(l.waiting, 'task has', 'tasks have')} been waiting too long. Follow up or let go.`);
      if (l.other) parts.push(`${plural(l.other, 'more item')} ${l.other === 1 ? 'is' : 'are'} unclear or stalled.`);
      return parts.join(' ');
    },
    reason: (k: DecisionKind, days: number, repeated = 0): string => {
      switch (k) {
        case 'overdue':
          return `${plural(days, 'day')} overdue.`;
        case 'waiting_too_long':
          return `Waiting for ${plural(days, 'working day')}.`;
        case 'repeated_reschedule':
          return `Rescheduled ${days} times.`;
        case 'lost_attention':
          return `In progress, nothing has moved for ${plural(days, 'day')}.`;
        case 'no_next_action':
          return 'No date and no next step.';
        case 'unprocessed_inbox':
          return `In the Inbox for ${plural(days, 'day')}.`;
        case 'stale_backlog':
          return repeated ? '' : `In the backlog for ${plural(days, 'day')}.`;
      }
    },
    also: (k: DecisionKind, count: number): string =>
      k === 'repeated_reschedule' ? `Rescheduled ${count} times.` : k === 'no_next_action' ? 'No next step.' : '',
    actions: {
      do: 'Do today',
      schedule: 'Schedule',
      delegate: 'Delegate',
      wait: 'Wait',
      follow_up: 'Follow up',
      keep_waiting: 'Keep waiting',
      backlog: 'Backlog',
      keep: 'Keep',
      drop: 'Drop',
    } as Record<DecisionAction, string>,
    showMore: (n: number) => `Show ${n} more`,
    showLess: 'Show fewer',
    capture: 'Capture',
    confirmDrop: 'Drop for good?',
  },

  delegate: { title: 'Delegate to', placeholder: 'Name', confirm: 'Delegate', hint: 'The task moves to Waiting.' },

  cleanup: {
    title: 'Weekly cleanup',
    intro: (n: number) => (n === 0 ? 'Nothing stale or unclear this week.' : `${plural(n, 'task')} to review, one at a time.`),
    start: 'Start cleanup',
    progress: (i: number, n: number) => `${i} of ${n}`,
    question: (k: CleanupKind, days: number, count: number): string => {
      switch (k) {
        case 'stale_backlog':
          return `This task has been in Backlog for ${plural(days, 'day')}. Is it still relevant?`;
        case 'lost_attention':
          return `In progress, but nothing has happened for ${plural(days, 'day')}. Is it still moving?`;
        case 'repeated_reschedule':
          return `Rescheduled ${count} times. Does it still belong in active work?`;
        case 'waiting_too_long':
          return `Waiting for ${plural(days, 'working day')}. Is a follow-up still worth it?`;
        case 'unprocessed_inbox':
          return `In the Inbox for ${plural(days, 'day')}. What is this?`;
        case 'no_project':
          return 'This task has no project. Where does it belong?';
        case 'no_next_action':
          return 'There is no date and no next step. What should happen next?';
      }
    },
    keep: 'Keep',
    skip: 'Skip',
    delete: 'Delete',
    done: 'Cleanup finished',
    doneBody: (reviewed: number) => (reviewed === 0 ? 'Nothing was changed.' : `You made ${plural(reviewed, 'decision')}.`),
    close: 'Close',
    tally: { schedule: 'scheduled', keep: 'kept', delegate: 'delegated', backlog: 'moved to backlog', drop: 'removed' } as Record<string, string>,
  },

  board: {
    title: 'Board',
    columns: { inbox: 'Inbox', backlog: 'Backlog', planned: 'Planned', in_progress: 'In progress', waiting: 'Waiting', done: 'Done' } as Record<TaskStatus, string>,
    emptyColumn: 'Nothing here',
    dropHere: 'Drop here',
    wip: (n: number, limit: number) => `${n} / ${limit}`,
    overLimit: 'Over limit',
    atLimit: 'At limit',
    moveTo: 'Move to',
    moveMenu: 'Move task',
    capture: 'Capture',
    doneExpand: 'Show done',
    doneCollapse: 'Hide done',
    showAll: (n: number) => `Show ${n} more`,
    deadline: (iso: string) => `Due ${fmt(iso)}`,
    idle: (d: number) => `Idle ${d} d`,
    waitingFor: (d: number) => `Waiting ${d} d`,
    inBacklog: (d: number) => `${d} d in backlog`,
    delegatedTo: (n: string) => `With ${n}`,
    noResults: 'Nothing matches these filters.',
  },

  wip: {
    title: (n: number) => `You already have ${n} tasks in progress. What should stop before this starts?`,
    starting: (title: string) => `Starting: ${title}`,
    pause: 'Pause',
    backlog: 'Backlog',
    complete: 'Complete',
    continue: 'Continue anyway',
    cancel: 'Cancel',
  },

  filters: {
    search: 'Search tasks',
    project: 'Project',
    anyProject: 'All projects',
    noProject: 'No project',
    status: 'Status',
    anyStatus: 'All statuses',
    priority: 'Priority',
    anyPriority: 'All priorities',
    deadline: 'Deadline',
    deadlines: { '': 'Any deadline', today: 'Due today', week: 'Next 7 days', none: 'No deadline' } as Record<string, string>,
    overdue: 'Overdue',
    waiting: 'Waiting too long',
    lost: 'Lost attention',
    today: 'Scheduled today',
    clear: 'Clear',
    result: (n: number) => `${plural(n, 'task')} shown`,
  },

  quickAdd: {
    placeholder: 'Add a task',
    add: 'Add',
    hint: 'Goes to Inbox unless you pick a status.',
    project: 'Project for the new task',
    deadline: 'Deadline for the new task',
    priority: 'Priority for the new task',
    status: 'Add to',
    added: 'Task added',
  },

  detail: {
    title: 'Task',
    project: 'Project',
    noProject: 'No project',
    person: 'Related person',
    notes: 'Notes',
    created: 'Created',
    lastActivity: 'Last activity',
    source: 'Source',
    delegatedTo: 'Delegated to',
    history: 'History',
    noHistory: 'No changes yet.',
    complete: 'Complete',
    scheduleToday: 'Schedule for today',
    reschedule: 'Reschedule',
    delegate: 'Delegate',
    backlog: 'Move to backlog',
    reopen: 'Reopen',
    sources: { manual: 'Added by hand', quick_add: 'Quick add', capture: 'Quick capture', seed: 'Demo data' } as Record<string, string>,
  },

  history: (e: TaskEvent): string => {
    const st = (v: string | null) => (v && v in t.statuses ? t.statuses[v as TaskStatus] : (v ?? ''));
    const when = `${fmt(e.at)}, ${fmtTime(e.at)}`;
    const line = ((): string => {
      switch (e.type) {
        case 'created':
          return 'Created';
        case 'status_changed':
          return `Status: ${st(e.from)} → ${st(e.to)}`;
        case 'deadline_changed':
          return `Deadline: ${fmt(e.from)} → ${fmt(e.to)}`;
        case 'scheduled':
          return `Scheduled for ${fmt(e.to)}`;
        case 'rescheduled':
          return `Rescheduled: ${fmt(e.from)} → ${fmt(e.to)}`;
        case 'moved_to_today':
          return 'Moved to today';
        case 'completed':
          return 'Completed';
        case 'reopened':
          return 'Reopened';
        case 'delegated':
          return `Delegated to ${e.to}`;
        case 'priority_changed':
          return `Priority: ${e.from} → ${e.to}`;
        case 'reviewed':
          return 'Reviewed';
      }
    })();
    return `${line} · ${when}`;
  },
};
