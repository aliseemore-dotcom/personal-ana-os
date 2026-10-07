import type { Scored } from '../../logic/prioritisation';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { Modal } from '../ui';

export function FocusPicker({ candidates, currentId, onClose }: { candidates: Scored[]; currentId?: string; onClose: () => void }) {
  const api = useTasks();
  return (
    <Modal title={t.focus.pickTitle} onClose={onClose}>
      <ul className="td-picker">
        {candidates.map(({ task, reasons }) => (
          <li key={task.id}>
            <button
              className="td-picker__item"
              data-current={task.id === currentId}
              onClick={() => {
                api.setFocus(task.id);
                onClose();
              }}
            >
              <span className="td-picker__title">{task.title}</span>
              <span className="rg-small rg-muted">{reasons.slice(0, 3).map(t.reason).join(' · ') || t.statuses[task.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
