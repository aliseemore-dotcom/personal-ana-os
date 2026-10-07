import { useState } from 'react';
import type { DecisionAction } from '../../logic/decisions';
import { t } from '../../strings';
import { RescheduleMenu } from '../today/menus';
import { DelegateMenu } from './DelegateMenu';
import type { DecisionArg } from '../../state/decisionActions';

/** The decision buttons for one item. The first action is the primary one. */
export function DecisionActions({
  actions,
  now,
  labels = t.decision.actions,
  onAct,
}: {
  actions: DecisionAction[];
  now: Date;
  labels?: Record<string, string>;
  onAct: (a: DecisionAction, arg?: DecisionArg) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <div className="td-att__actions">
        <span className="rg-small">{t.decision.confirmDrop}</span>
        <button className="td-pill td-pill--danger" onClick={() => onAct('drop')}>{labels.drop}</button>
        <button className="td-pill" onClick={() => setConfirm(false)}>{t.attention.no}</button>
      </div>
    );
  }
  return (
    <div className="td-att__actions">
      {actions.map((a, i) => {
        const cls = `td-pill${i === 0 ? ' td-pill--solid' : ''}`;
        if (a === 'schedule') return <RescheduleMenu key={a} now={now} className={cls} label={labels[a]} onPick={(d) => onAct(a, d)} align="left">{labels[a]}</RescheduleMenu>;
        if (a === 'delegate') return <DelegateMenu key={a} className={cls} label={labels[a]} onPick={(n) => onAct(a, n)} />;
        if (a === 'drop') return <button key={a} className={cls} onClick={() => setConfirm(true)}>{labels[a]}</button>;
        return <button key={a} className={cls} onClick={() => onAct(a)}>{labels[a]}</button>;
      })}
    </div>
  );
}
