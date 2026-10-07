import { useState } from 'react';
import type { TodayModel } from '../../logic/todayModel';
import { t } from '../../strings';
import { TaskRow } from './TaskRow';

export function TodayTasks({ model, now, onOpen }: { model: TodayModel; now: Date; onOpen: (id: string) => void }) {
  const [more, setMore] = useState(false);
  const empty = model.priority.length === 0 && model.quick.length === 0;
  return (
    <section className="rg-card td-tasks" aria-labelledby="tasks-title">
      <div className="td-section-head">
        <h2 className="rg-h2" id="tasks-title">{t.tasks.title}</h2>
        {model.doneToday > 0 && <span className="rg-small rg-muted">{t.tasks.doneToday(model.doneToday)}</span>}
      </div>

      {empty && <p className="td-empty td-empty--ink">{t.tasks.empty}</p>}

      {model.priority.length > 0 && (
        <>
          <h3 className="rg-label td-sub">{t.tasks.priority}</h3>
          <ul className="td-list">
            {model.priority.map((s) => <TaskRow key={s.task.id} item={s} now={now} onOpen={onOpen} />)}
          </ul>
        </>
      )}

      {model.quick.length > 0 && (
        <>
          <h3 className="rg-label td-sub">{t.tasks.quick}</h3>
          <ul className="td-list td-list--quick">
            {model.quick.map((s) => <TaskRow key={s.task.id} item={s} now={now} onOpen={onOpen} />)}
          </ul>
        </>
      )}

      {model.hiddenCount > 0 && (
        <>
          <button className="td-link td-more" onClick={() => setMore((v) => !v)} aria-expanded={more}>
            {more ? t.tasks.fewer : t.tasks.more(model.hiddenCount)}
          </button>
          {more && (
            <ul className="td-list">
              {model.hidden.map((s) => <TaskRow key={s.task.id} item={s} now={now} onOpen={onOpen} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
