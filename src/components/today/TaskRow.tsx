import { ArrowUpRight, Check, Undo2 } from 'lucide-react';
import { calendarDaysBetween } from '../../domain/dates';
import type { Scored } from '../../logic/prioritisation';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { PriorityMenu, RescheduleMenu } from './menus';

export function TaskRow({ item, now, onOpen }: { item: Scored; now: Date; onOpen: (id: string) => void }) {
  const api = useTasks();
  const { task } = item;
  const done = task.status === 'done';
  const project = task.project_id ? api.projects.get(task.project_id)?.name : null;

  const overdue = task.deadline && new Date(task.deadline).getTime() < now.getTime() ? calendarDaysBetween(new Date(task.deadline), now) : null;
  const dueToday = !overdue && task.deadline && calendarDaysBetween(now, new Date(task.deadline)) === 0;

  return (
    <li className="td-task" data-done={done} data-priority={task.priority}>
      <button
        className="td-check"
        onClick={() => (done ? api.undoComplete(task.id) : api.complete(task.id))}
        aria-label={done ? t.tasks.undo : `${t.tasks.complete}: ${task.title}`}
        aria-pressed={done}
      >
        {done ? <Check size={14} /> : null}
      </button>

      <div className="td-task__main">
        <button className="td-task__title" onClick={() => onOpen(task.id)}>{task.title}</button>
        <p className="rg-small td-task__meta">
          {[project, task.estimated_duration ? t.minutes(task.estimated_duration) : null].filter(Boolean).join(' · ')}
          {overdue !== null && <span className="rg-tag rg-tag--danger td-tag-inline"><span className="rg-tag__dot" />{t.overdueTag(Math.max(1, overdue))}</span>}
          {dueToday && <span className="rg-tag rg-tag--rose td-tag-inline">{t.dueToday}</span>}
          {task.priority === 'high' && !done && <span className="rg-tag td-tag-inline">{t.priorities.high}</span>}
        </p>
      </div>

      {done ? (
        <button className="td-link" onClick={() => api.undoComplete(task.id)}><Undo2 size={14} /> {t.tasks.undo}</button>
      ) : (
        <div className="td-task__actions">
          <RescheduleMenu now={now} onPick={(d) => api.reschedule(task.id, d)} />
          <PriorityMenu value={task.priority} onPick={(p) => api.setPriority(task.id, p)} />
          <button className="rg-icon-btn rg-icon-btn--glass td-icon-sm" onClick={() => onOpen(task.id)} aria-label={t.tasks.open} title={t.tasks.open}>
            <ArrowUpRight />
          </button>
        </div>
      )}
    </li>
  );
}
