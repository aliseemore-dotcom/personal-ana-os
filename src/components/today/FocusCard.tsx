import { ArrowLeftRight, Check, CalendarClock, Undo2 } from 'lucide-react';
import type { TodayModel } from '../../logic/todayModel';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { RescheduleMenu } from './menus';

export function FocusCard({
  model,
  now,
  onChange,
  onOpen,
}: {
  model: TodayModel;
  now: Date;
  onChange: () => void;
  onOpen: (id: string) => void;
}) {
  const api = useTasks();
  const focus = model.focus;

  if (!focus) {
    return (
      <section className="rg-card td-focus" aria-labelledby="focus-label">
        <div className="td-clip" aria-hidden><div className="rg-card__glow td-focus__glow" /></div>
        <p className="rg-label" id="focus-label">{t.focus.label}</p>
        <p className="td-focus__empty">{model.doneToday > 0 ? t.focus.emptyDone : t.focus.empty}</p>
      </section>
    );
  }

  const { task, reasons } = focus;
  const done = task.status === 'done';
  const project = task.project_id ? api.projects.get(task.project_id)?.name : null;

  return (
    <section className="rg-card td-focus" aria-labelledby="focus-label" data-done={done}>
      <div className="td-clip" aria-hidden><div className="rg-card__glow td-focus__glow" /></div>
      <div className="td-focus__top">
        <p className="rg-label" id="focus-label">{t.focus.label}</p>
        <span className="td-focus__origin">{model.focusIsManual ? t.focus.chosen : t.focus.suggested}</span>
      </div>

      <h2 className="td-focus__title">
        <button className="td-focus__open" onClick={() => onOpen(task.id)}>{task.title}</button>
      </h2>
      {project && <p className="td-focus__project">{project}</p>}

      {reasons.length > 0 && !done && (
        <div className="td-focus__why">
          <p className="rg-label">{t.focus.why}</p>
          <ul className="td-chips">
            {reasons.slice(0, 4).map((r) => (
              <li key={r.code} className="td-chip">{t.reason(r)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="td-focus__actions">
        {done ? (
          <>
            <span className="td-chip td-chip--done"><Check size={14} /> {t.focus.completed}</span>
            <button className="rg-btn rg-btn--glass" onClick={() => api.undoComplete(task.id)}>
              <Undo2 /> {t.focus.undo}
            </button>
          </>
        ) : (
          <>
            <button className="rg-btn rg-btn--rose" onClick={() => api.complete(task.id)}>
              <Check /> {t.focus.complete}
            </button>
            <button className="rg-btn rg-btn--glass" onClick={onChange}>
              <ArrowLeftRight /> {t.focus.changeFocus}
            </button>
            <RescheduleMenu
              now={now}
              align="left"
              label={t.focus.reschedule}
              className="rg-btn rg-btn--glass"
              onPick={(d) => api.reschedule(task.id, d)}
            >
              <CalendarClock /> {t.focus.reschedule}
            </RescheduleMenu>
          </>
        )}
      </div>
    </section>
  );
}
