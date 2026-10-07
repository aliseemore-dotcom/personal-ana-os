import { useState } from 'react';
import { CalendarClock, Flag } from 'lucide-react';
import { addDays, dateKey, fromDateKey, nextMonday, startOfDay } from '../../domain/dates';
import type { Priority } from '../../domain/types';
import { t } from '../../strings';
import { Popover } from '../ui';

export function RescheduleMenu({
  onPick,
  now,
  label = t.tasks.reschedule,
  className = 'rg-icon-btn rg-icon-btn--glass td-icon-sm',
  children,
  align,
}: {
  onPick: (day: Date) => void;
  now: Date;
  label?: string;
  className?: string;
  children?: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const today = startOfDay(now);
  const options: [string, Date][] = [
    [t.reschedule.tomorrow, addDays(today, 1)],
    [t.reschedule.inTwoDays, addDays(today, 2)],
    [t.reschedule.nextMonday, nextMonday(today)],
  ];
  const [custom, setCustom] = useState(dateKey(addDays(today, 3)));

  return (
    <Popover
      align={align}
      trigger={({ toggle, open }) => (
        <button className={className} onClick={toggle} aria-label={label} aria-expanded={open} title={label}>
          {children ?? <CalendarClock />}
        </button>
      )}
    >
      {(close) => (
        <>
          {options.map(([name, day]) => (
            <button key={name} className="td-menu__item" role="menuitem" onClick={() => (onPick(day), close())}>
              {name}
              <span className="rg-small rg-muted">{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </button>
          ))}
          <div className="td-menu__custom">
            <input type="date" value={custom} min={dateKey(addDays(today, 1))} onChange={(e) => setCustom(e.target.value)} aria-label={t.reschedule.pick} />
            <button className="rg-input__action td-menu__set" onClick={() => custom && (onPick(fromDateKey(custom)), close())}>
              {t.reschedule.apply}
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}

export function PriorityMenu({ value, onPick }: { value: Priority; onPick: (p: Priority) => void }) {
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button className="rg-icon-btn rg-icon-btn--glass td-icon-sm" onClick={toggle} aria-label={t.tasks.changePriority} aria-expanded={open} title={t.tasks.changePriority}>
          <Flag />
        </button>
      )}
    >
      {(close) =>
        (['high', 'medium', 'low'] as Priority[]).map((p) => (
          <button key={p} className="td-menu__item" role="menuitemradio" aria-checked={p === value} onClick={() => (onPick(p), close())}>
            {t.priorities[p]}
            {p === value && <span className="rg-small rg-muted">Current</span>}
          </button>
        ))
      }
    </Popover>
  );
}
