import { useState } from 'react';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { Popover } from '../ui';

export function DelegateMenu({ onPick, className = 'td-pill', label = t.detail.delegate }: { onPick: (name: string) => void; className?: string; label?: string }) {
  const { people } = useTasks();
  const [name, setName] = useState('');
  const listId = `people-${label.replace(/\s/g, '')}`;
  return (
    <Popover
      align="left"
      trigger={({ toggle, open }) => (
        <button className={className} onClick={toggle} aria-expanded={open}>
          {label}
        </button>
      )}
    >
      {(close) => (
        <form
          className="tk-delegate"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onPick(name.trim());
            setName('');
            close();
          }}
        >
          <label className="rg-label" htmlFor={listId}>{t.delegate.title}</label>
          <input id={listId} list={`${listId}-list`} className="td-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.delegate.placeholder} autoFocus />
          <datalist id={`${listId}-list`}>{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          <p className="rg-small rg-muted">{t.delegate.hint}</p>
          <button className="td-pill td-pill--solid" type="submit" disabled={!name.trim()}>{t.delegate.confirm}</button>
        </form>
      )}
    </Popover>
  );
}
