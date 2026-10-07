import type { Task } from '../../domain/types';
import { t } from '../../strings';
import { Modal } from '../ui';

/**
 * Facilitator prompt, not a block: the user frees a slot, or carries on regardless.
 */
export function WipDialog({
  incoming, inProgress, projectName, onFree, onContinue, onCancel,
}: {
  incoming: string;
  inProgress: Task[];
  projectName: (id: string | null) => string;
  onFree: (id: string, how: 'pause' | 'backlog' | 'complete') => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={t.wip.title(inProgress.length)} onClose={onCancel}>
      <p className="rg-small rg-muted">{t.wip.starting(incoming)}</p>
      <ul className="tk-wip">
        {inProgress.map((task) => (
          <li key={task.id} className="tk-wip__row">
            <div>
              <p className="tk-dec__title">{task.title}</p>
              <p className="rg-small rg-muted">{projectName(task.project_id)}</p>
            </div>
            <div className="td-att__actions">
              <button className="td-pill" onClick={() => onFree(task.id, 'pause')}>{t.wip.pause}</button>
              <button className="td-pill" onClick={() => onFree(task.id, 'backlog')}>{t.wip.backlog}</button>
              <button className="td-pill" onClick={() => onFree(task.id, 'complete')}>{t.wip.complete}</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="td-modal__foot">
        <span className="td-modal__spacer" />
        <button className="rg-btn rg-btn--glass" onClick={onCancel}>{t.wip.cancel}</button>
        <button className="rg-btn" onClick={onContinue}>{t.wip.continue}</button>
      </div>
    </Modal>
  );
}
