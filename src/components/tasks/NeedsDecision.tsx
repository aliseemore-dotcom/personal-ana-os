import { useState } from 'react';
import type { DecisionItem, DecisionsLead } from '../../logic/decisions';
import { useTasks } from '../../state/TasksProvider';
import { useDecisionActions } from '../../state/decisionActions';
import { t } from '../../strings';
import { DecisionActions } from './DecisionActions';

const VISIBLE = 5;

function Row({ item, now, onOpen }: { item: DecisionItem; now: Date; onOpen: (id: string) => void }) {
  const api = useTasks();
  const act = useDecisionActions();
  const task = item.task;
  const project = task?.project_id ? api.projects.get(task.project_id)?.name : null;
  const title = task?.title ?? item.capture!.content;
  const notes = [
    t.decision.reason(item.kind, item.days),
    ...item.also.map((k) => t.decision.also(k, task?.reschedule_count ?? 0)).filter(Boolean),
  ].filter(Boolean);

  return (
    <li className="tk-dec" data-kind={item.kind}>
      <div className="tk-dec__main">
        <p className="tk-dec__title">
          {item.capture && <span className="rg-tag tk-tag-xs">{t.decision.capture}</span>}
          {task ? <button className="td-task__title tk-dec__open" onClick={() => onOpen(task.id)}>{title}</button> : <span>{title}</span>}
        </p>
        <p className="rg-small tk-dec__why">
          {notes.join(' ')}
          {project && <span className="rg-muted"> · {project}</span>}
          {task?.delegated_to && <span className="rg-muted"> · {t.board.delegatedTo(task.delegated_to)}</span>}
        </p>
      </div>
      <DecisionActions actions={item.actions} now={now} onAct={(a, arg) => act(item, a, arg)} />
    </li>
  );
}

export function NeedsDecision({ items, lead, now, onOpen }: { items: DecisionItem[]; lead: DecisionsLead; now: Date; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, VISIBLE);
  const text = t.decision.lead(lead);
  return (
    <section className="rg-card tk-decisions" aria-labelledby="dec-title">
      <div className="td-section-head">
        <h2 className="rg-h2" id="dec-title">{t.decision.title}</h2>
        {items.length > 0 && <span className={`rg-count${lead.overdue > 0 ? ' rg-count--danger' : ' rg-count--warning'}`} aria-label={`${items.length} items`}>{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="td-empty td-empty--ink">{t.decision.none}</p>
      ) : (
        <>
          {text && <p className="tk-decisions__lead">{text}</p>}
          <ul className="tk-dec__list">
            {shown.map((it) => <Row key={it.id} item={it} now={now} onOpen={onOpen} />)}
          </ul>
          {items.length > VISIBLE && (
            <button className="td-link tk-more" onClick={() => setAll((v) => !v)}>
              {all ? t.decision.showLess : t.decision.showMore(items.length - VISIBLE)}
            </button>
          )}
        </>
      )}
    </section>
  );
}
