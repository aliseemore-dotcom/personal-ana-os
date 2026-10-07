import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { endOfDay, fromDateKey } from '../../domain/dates';
import type { Priority, Project, TaskStatus } from '../../domain/types';
import { EMPTY_FILTERS, hasFacets, isFiltering, type Filters } from '../../logic/filters';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';

const STATUSES: TaskStatus[] = ['inbox', 'backlog', 'planned', 'in_progress', 'waiting', 'done'];

export function QuickAdd() {
  const api = useTasks();
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('inbox');
  const projects = [...api.projects.values()];

  const submit = () => {
    if (!title.trim()) return;
    api.addTask({ title, project_id: project || null, deadline: deadline ? endOfDay(fromDateKey(deadline)).toISOString() : null, priority, status });
    api.notify(t.quickAdd.added);
    setTitle(''); setProject(''); setDeadline(''); setPriority('medium'); setStatus('inbox');
  };

  return (
    <div className="tk-add" data-filled={title.trim() !== ''}>
      <label className="rg-input">
        <span className="rg-input__icon"><Plus /></span>
        <input id="quick-add" value={title} placeholder={t.quickAdd.placeholder} aria-label={t.quickAdd.placeholder} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="rg-input__action" onClick={submit} disabled={!title.trim()}>{t.quickAdd.add}</button>
      </label>
      <div className="tk-add__opts">
        <select className="tk-select" aria-label={t.quickAdd.project} value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">{t.detail.noProject}</option>
          {projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="tk-select" type="date" aria-label={t.quickAdd.deadline} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <select className="tk-select" aria-label={t.quickAdd.priority} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{t.priorities[p]}</option>)}
        </select>
        <select className="tk-select" aria-label={t.quickAdd.status} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          {STATUSES.map((s) => <option key={s} value={s}>{t.board.columns[s]}</option>)}
        </select>
        <span className="rg-small tk-add__hint">{t.quickAdd.hint}</span>
      </div>
    </div>
  );
}

export function FilterBar({ filters, onChange, count }: { filters: Filters; onChange: (f: Filters) => void; count: number }) {
  const api = useTasks();
  const projects = [...api.projects.values()];
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const flag = (k: 'overdue' | 'waiting' | 'lost' | 'today', label: string) => (
    <button key={k} className="tk-chip" aria-pressed={filters[k]} onClick={() => set(k, !filters[k])}>{label}</button>
  );

  return (
    <div className="tk-filters">
      <label className="rg-input tk-search">
        <span className="rg-input__icon"><Search /></span>
        <input id="task-search" type="search" value={filters.query} placeholder={t.filters.search} aria-label={t.filters.search} onChange={(e) => set('query', e.target.value)} />
      </label>
      <div className="tk-filters__row">
        <select className="tk-select" aria-label={t.filters.project} value={filters.project} onChange={(e) => set('project', e.target.value)}>
          <option value="">{t.filters.anyProject}</option>
          <option value="__none">{t.filters.noProject}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="tk-select" aria-label={t.filters.status} value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])}>
          <option value="">{t.filters.anyStatus}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t.board.columns[s]}</option>)}
        </select>
        <select className="tk-select" aria-label={t.filters.priority} value={filters.priority} onChange={(e) => set('priority', e.target.value as Filters['priority'])}>
          <option value="">{t.filters.anyPriority}</option>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{t.priorities[p]}</option>)}
        </select>
        <select className="tk-select" aria-label={t.filters.deadline} value={filters.deadline} onChange={(e) => set('deadline', e.target.value as Filters['deadline'])}>
          {Object.entries(t.filters.deadlines).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {flag('overdue', t.filters.overdue)}
        {flag('waiting', t.filters.waiting)}
        {flag('lost', t.filters.lost)}
        {flag('today', t.filters.today)}
        {isFiltering(filters) && (
          <>
            <button className="td-pill" onClick={() => onChange(EMPTY_FILTERS)}><X size={14} /> {t.filters.clear}</button>
            <span className="rg-small" aria-live="polite">{hasFacets(filters) || filters.query ? t.filters.result(count) : ''}</span>
          </>
        )}
      </div>
    </div>
  );
}
