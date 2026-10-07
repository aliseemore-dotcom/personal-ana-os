import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AttentionGroup, AttentionItem, AttentionSummary } from '../../logic/attention';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { RescheduleMenu } from './menus';

const GROUPS: AttentionGroup[] = ['overdue', 'waiting', 'forgotten'];
const TAG: Record<AttentionGroup, string> = {
  overdue: 'rg-tag rg-tag--danger',
  waiting: 'rg-tag rg-tag--warning',
  forgotten: 'rg-tag rg-tag--rose',
};

function Row({ item, now }: { item: AttentionItem; now: Date }) {
  const api = useTasks();
  const [confirm, setConfirm] = useState(false);
  const { task } = item;
  const a = t.attention.actions;
  return (
    <li className="td-att__row">
      <div>
        <p className="td-att__title">{task.title}</p>
        <p className="rg-small rg-muted">{t.attention.detail(item)}</p>
      </div>
      {confirm ? (
        <div className="td-att__actions">
          <span className="rg-small">{t.attention.confirmDelete}</span>
          <button className="td-pill td-pill--danger" onClick={() => api.remove(task.id)}>{t.attention.yes}</button>
          <button className="td-pill" onClick={() => setConfirm(false)}>{t.attention.no}</button>
        </div>
      ) : (
        <div className="td-att__actions">
          <button className="td-pill td-pill--solid" onClick={() => api.scheduleToday(task.id)}>{a.do}</button>
          <RescheduleMenu now={now} className="td-pill" label={a.reschedule} onPick={(d) => api.reschedule(task.id, d)} align="left">
            {a.reschedule}
          </RescheduleMenu>
          {item.kind === 'stale_backlog' ? (
            <button className="td-pill" onClick={() => api.review(task.id)}>{a.keep}</button>
          ) : (
            <button className="td-pill" onClick={() => api.moveToBacklog(task.id)}>{a.backlog}</button>
          )}
          <button className="td-pill" onClick={() => setConfirm(true)}>{a.delete}</button>
        </div>
      )}
    </li>
  );
}

export function AttentionNeeded({ summary, now }: { summary: AttentionSummary; now: Date }) {
  const [open, setOpen] = useState<AttentionGroup | null>(null);
  // A group that empties itself (after the last item is handled) collapses on its own.
  const active = open && summary.byGroup[open].length > 0 ? open : null;

  return (
    <section className="rg-glass td-att" aria-labelledby="att-title">
      <h2 className="rg-h2" id="att-title">{t.attention.title}</h2>

      {summary.total === 0 ? (
        <p className="td-empty">{t.attention.clear}</p>
      ) : (
        <div className="td-att__summary">
          {GROUPS.map((g) => {
            const n = summary.byGroup[g].length;
            return (
              <button
                key={g}
                className={`td-att__count ${n === 0 ? 'td-att__count--zero' : ''}`}
                onClick={() => setOpen(active === g ? null : g)}
                aria-expanded={active === g}
                disabled={n === 0}
              >
                <span className={`${TAG[g]} td-att__num`}>{n}</span>
                <span>{t.attention.groups[g]}</span>
                <ChevronDown size={16} className="td-att__chev" data-open={active === g} />
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div className="td-att__panel rg-card td-att__list">
          <p className="rg-small rg-muted">{t.attention.groupHint[active]}</p>
          <ul>
            {summary.byGroup[active].map((it) => <Row key={it.task.id} item={it} now={now} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
