import type { Signal } from './projectHealth';
import type { ProjectView } from './projectViews';

export type LineTone = 'danger' | 'warning' | 'neutral';

export interface ProjectLine {
  code: Signal['code'] | 'calm';
  /** How urgent the line is; drives the sphere colour and the order. */
  tone: LineTone;
  project: string;
  n: number;
  detail?: string;
}

export interface ProjectsSummary {
  total: number;
  active: number;
  needAttention: number;
  /** Calm, operational observations; at most four. */
  lines: ProjectLine[];
  noNextAction: number;
}

const TONE: Record<Signal['code'], LineTone> = {
  blocker: 'danger',
  overdue_milestone: 'warning',
  overdue_tasks: 'warning',
  waiting_long: 'warning',
  workstream_stalled: 'warning',
  inactive: 'warning',
  no_next_action: 'neutral',
};
const TONE_RANK: Record<LineTone, number> = { danger: 0, warning: 1, neutral: 2 };

const PRIORITY: Signal['code'][] = ['blocker', 'overdue_milestone', 'overdue_tasks', 'waiting_long', 'workstream_stalled', 'inactive', 'no_next_action'];

/** "What should I notice before opening anything?" Interprets state rather than repeating counts. */
export function buildProjectsSummary(views: ProjectView[]): ProjectsSummary {
  const open = views.filter((v) => v.project.status !== 'completed');
  const attention = open.filter((v) => v.assessment.health !== 'on_track');
  const noNext = open.filter((v) => v.assessment.signals.some((s) => s.code === 'no_next_action'));

  const lines: ProjectLine[] = [];
  for (const v of attention) {
    // A project with no next action is summarised once, in aggregate, below.
    const sig = PRIORITY.map((c) => v.assessment.signals.find((s) => s.code === c)).find((s) => s && s.code !== 'no_next_action');
    if (!sig) continue;
    lines.push({ code: sig.code, tone: TONE[sig.code], project: v.project.name, n: sig.n, detail: sig.code === 'blocker' ? v.project.blocker ?? undefined : undefined });
  }
  // Most urgent first (stable within a tone, so the signal order above still decides ties).
  lines.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || PRIORITY.indexOf(a.code as Signal['code']) - PRIORITY.indexOf(b.code as Signal['code']));
  const noNextOnly = noNext.length;
  const shown = lines.slice(0, noNextOnly ? 3 : 4);
  if (noNextOnly) shown.push({ code: 'no_next_action', tone: 'neutral', project: noNext.length === 1 ? noNext[0].project.name : '', n: noNextOnly });
  return { total: views.length, active: views.filter((v) => v.project.status === 'active').length, needAttention: attention.length, lines: shown, noNextAction: noNextOnly };
}
