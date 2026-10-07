import type { AttentionItem } from './logic/attention';
import type { Reason } from './logic/prioritisation';
import type { Priority } from './domain/types';

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
    more: (n: number) => `${n} more planned for today — they appear as you finish these.`,
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
  loading: 'Loading your day…',
  errors: {
    load: 'Could not load your tasks.',
    save: 'That change did not save — it has been undone.',
  },
};
