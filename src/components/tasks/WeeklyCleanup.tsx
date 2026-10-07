import { useState } from 'react';
import type { CleanupItem } from '../../logic/cleanup';
import { useTasks } from '../../state/TasksProvider';
import { useDecisionActions, type DecisionArg } from '../../state/decisionActions';
import type { DecisionAction } from '../../logic/decisions';
import { t } from '../../strings';
import { Modal } from '../ui';
import { DecisionActions } from './DecisionActions';

/** The dark entry card on the page: the one accent of the TASKS screen. */
export function CleanupCard({ count, onStart }: { count: number; onStart: () => void }) {
  return (
    <section className="rg-card rg-card--inverse tk-cleanup" aria-labelledby="cleanup-title">
      <div className="td-clip" aria-hidden><div className="rg-card__glow tk-cleanup__glow" /></div>
      <h2 className="rg-label" id="cleanup-title">{t.cleanup.title}</h2>
      <p className="tk-cleanup__text">{t.cleanup.intro(count)}</p>
      <button className="rg-btn rg-btn--rose" onClick={onStart} disabled={count === 0}>{t.cleanup.start}</button>
    </section>
  );
}

const LABELS: Record<string, string> = { ...t.decision.actions, keep: t.cleanup.keep, drop: t.cleanup.delete };

/** One decision at a time, then straight on to the next. */
export function WeeklyCleanup({ queue, now, onClose }: { queue: CleanupItem[]; now: Date; onClose: () => void }) {
  const api = useTasks();
  const act = useDecisionActions();
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});

  const item = queue[i];
  const live = item?.task ? api.tasks.find((x) => x.id === item.id) ?? item.task : undefined;
  const title = live?.title ?? item?.capture?.content ?? '';
  const project = live?.project_id ? api.projects.get(live.project_id)?.name : null;

  const next = () => setI((n) => n + 1);
  const decide = (a: DecisionAction, arg?: DecisionArg) => {
    act({ id: item.id, task: item.task, capture: item.capture }, a, arg);
    setTally((x) => ({ ...x, [a]: (x[a] ?? 0) + 1 }));
    next();
  };

  const finished = i >= queue.length;
  const reviewed = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <Modal title={t.cleanup.title} onClose={onClose}>
      {finished ? (
        <div className="tk-clean">
          <h3 className="rg-h2">{t.cleanup.done}</h3>
          <p>{t.cleanup.doneBody(reviewed)}</p>
          {reviewed > 0 && (
            <p className="rg-small rg-muted">
              {Object.entries(tally).map(([k, n]) => `${n} ${t.cleanup.tally[k] ?? k}`).join(' · ')}
            </p>
          )}
          <div className="td-modal__foot"><span className="td-modal__spacer" /><button className="rg-btn" onClick={onClose}>{t.cleanup.close}</button></div>
        </div>
      ) : (
        <div className="tk-clean">
          <div className="tk-clean__bar" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={i} aria-label={t.cleanup.progress(i + 1, queue.length)}>
            <span style={{ width: `${(i / queue.length) * 100}%` }} />
          </div>
          <p className="rg-small rg-muted">{t.cleanup.progress(i + 1, queue.length)}</p>
          <h3 className="tk-clean__title">“{title}”</h3>
          {project && <p className="rg-small rg-muted">{project}</p>}
          <p className="tk-clean__q">{t.cleanup.question(item.kind, item.days, live?.reschedule_count ?? 0)}</p>
          <DecisionActions key={item.id} actions={item.actions} now={now} labels={LABELS} onAct={decide} />
          <div className="td-modal__foot">
            <button className="td-link" onClick={next}>{t.cleanup.skip}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
