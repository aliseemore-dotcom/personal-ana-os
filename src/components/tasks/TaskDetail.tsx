import { useEffect, useState } from 'react';
import { dateKey, endOfDay, fromDateKey } from '../../domain/dates';
import type { Priority, Task, TaskEvent, TaskStatus } from '../../domain/types';
import { useProjects } from '../../state/ProjectsProvider';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { RescheduleMenu } from '../today/menus';
import { Modal } from '../ui';
import { DelegateMenu } from './DelegateMenu';

const STATUSES: TaskStatus[] = ['inbox', 'backlog', 'planned', 'in_progress', 'waiting', 'done'];

/**
 * Full task detail, shared by TODAY and TASKS (same records, same actions).
 * `onMove` lets TASKS route a status change through the In progress limit prompt.
 */
export function TaskDetail({ task, now, onClose, onMove }: { task: Task; now: Date; onClose: () => void; onMove?: (id: string, to: TaskStatus) => void }) {
  const api = useTasks();
  const proj = useProjects();
  const personName = api.people.find((p) => p.id === task.assigned_person_id)?.name ?? '';
  const [f, setF] = useState({
    title: task.title,
    description: task.description ?? '',
    notes: task.notes ?? '',
    project: task.project_id ?? '',
    workstream: task.workstream_id ?? '',
    person: personName,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline ? dateKey(new Date(task.deadline)) : '',
    scheduled: task.scheduled_date ?? '',
    duration: task.estimated_duration ? String(task.estimated_duration) : '',
    impact: String(task.impact_score),
    blocks: task.blocks_others,
    blocksNote: task.blocks_note ?? '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  useEffect(() => {
    let alive = true;
    void api.loadEvents(task.id).then((e) => alive && setEvents(e));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, task.updated_at]);

  const save = async () => {
    if (!f.title.trim()) return;
    const personId = f.person.trim() ? await api.ensurePerson(f.person) : null;
    const statusChanged = f.status !== task.status;
    api.edit(task.id, {
      title: f.title.trim(),
      description: f.description.trim() || null,
      notes: f.notes.trim() || null,
      project_id: f.project || null,
      workstream_id: f.project ? f.workstream || null : null,
      assigned_person_id: personId,
      priority: f.priority,
      deadline: f.deadline ? endOfDay(fromDateKey(f.deadline)).toISOString() : null,
      scheduled_date: f.scheduled || null,
      estimated_duration: Number(f.duration) > 0 ? Math.round(Number(f.duration)) : null,
      impact_score: Math.min(10, Math.max(1, Math.round(Number(f.impact)) || 5)),
      blocks_others: f.blocks,
      blocks_note: f.blocks ? f.blocksNote.trim() || null : null,
    });
    if (statusChanged) (onMove ?? api.setStatus)(task.id, f.status);
    onClose();
  };

  const done = task.status === 'done';
  const history: { key: string; text: string }[] = events.map((e) => ({ key: e.id, text: t.history(e) }));
  if (!events.some((e) => e.type === 'created')) {
    history.push({ key: 'created', text: t.history({ id: 'c', task_id: task.id, type: 'created', at: task.created_at, from: null, to: null }) });
  }

  return (
    <Modal title={t.detail.title} onClose={onClose}>
      <div className="td-form">
        <label className="td-field td-field--wide">
          <span className="rg-label">{t.dialog.name}</span>
          <input className="td-input" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </label>
        <label className="td-field td-field--wide">
          <span className="rg-label">{t.dialog.description}</span>
          <textarea className="td-input td-input--area" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label className="td-field">
          <span className="rg-label">{t.detail.project}</span>
          <select className="td-input" value={f.project} onChange={(e) => setF((s) => ({ ...s, project: e.target.value, workstream: '' }))}>
            <option value="">{t.detail.noProject}</option>
            {[...api.projects.values()].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {proj.workstreams.some((w) => w.project_id === f.project) && (
          <label className="td-field">
            <span className="rg-label">{t.detail.workstream}</span>
            <select className="td-input" value={f.workstream} onChange={(e) => set('workstream', e.target.value)}>
              <option value="">{t.hq.wholeProject}</option>
              {proj.workstreams.filter((w) => w.project_id === f.project).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
        <label className="td-field">
          <span className="rg-label">{t.dialog.status}</span>
          <select className="td-input" value={f.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{t.statuses[s]}</option>)}
          </select>
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.priority}</span>
          <select className="td-input" value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
            {(['high', 'medium', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{t.priorities[p]}</option>)}
          </select>
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.duration}</span>
          <input className="td-input" type="number" min={1} step={5} value={f.duration} onChange={(e) => set('duration', e.target.value)} />
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.deadline}</span>
          <input className="td-input" type="date" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.scheduled}</span>
          <input className="td-input" type="date" value={f.scheduled} onChange={(e) => set('scheduled', e.target.value)} />
        </label>
        <label className="td-field">
          <span className="rg-label">{t.detail.person}</span>
          <input className="td-input" list="detail-people" value={f.person} onChange={(e) => set('person', e.target.value)} />
          <datalist id="detail-people">{api.people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.impact}</span>
          <input className="td-input" type="number" min={1} max={10} value={f.impact} onChange={(e) => set('impact', e.target.value)} />
        </label>
        <label className="td-field td-field--wide td-field--check">
          <input type="checkbox" checked={f.blocks} onChange={(e) => set('blocks', e.target.checked)} />
          <span>{t.dialog.blocks}</span>
        </label>
        {f.blocks && (
          <label className="td-field td-field--wide">
            <span className="rg-label">{t.dialog.blocksNote}</span>
            <input className="td-input" value={f.blocksNote} onChange={(e) => set('blocksNote', e.target.value)} />
          </label>
        )}
        <label className="td-field td-field--wide">
          <span className="rg-label">{t.detail.notes}</span>
          <textarea className="td-input td-input--area" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>

      <dl className="tk-facts">
        <div><dt>{t.detail.created}</dt><dd>{t.fmtDate(task.created_at)}</dd></div>
        <div><dt>{t.detail.lastActivity}</dt><dd>{t.fmtDate(task.last_activity_at)}</dd></div>
        <div><dt>{t.detail.source}</dt><dd>{t.detail.sources[task.source] ?? task.source}</dd></div>
        {task.delegated_to && <div><dt>{t.detail.delegatedTo}</dt><dd>{task.delegated_to}</dd></div>}
      </dl>

      <div className="tk-history">
        <h3 className="rg-label">{t.detail.history}</h3>
        {history.length === 0 ? <p className="rg-small rg-muted">{t.detail.noHistory}</p> : (
          <ul>{history.slice(0, 8).map((h) => <li key={h.key} className="rg-small">{h.text}</li>)}</ul>
        )}
      </div>

      <div className="td-att__actions tk-detail-actions">
        {done ? (
          <button className="td-pill td-pill--solid" onClick={() => { api.undoComplete(task.id); onClose(); }}>{t.detail.reopen}</button>
        ) : (
          <>
            <button className="td-pill td-pill--solid" onClick={() => { api.complete(task.id); onClose(); }}>{t.detail.complete}</button>
            <button className="td-pill" onClick={() => { api.scheduleToday(task.id); onClose(); }}>{t.detail.scheduleToday}</button>
            <RescheduleMenu now={now} className="td-pill" label={t.detail.reschedule} align="left" onPick={(d) => { api.reschedule(task.id, d); onClose(); }}>{t.detail.reschedule}</RescheduleMenu>
            <DelegateMenu label={t.detail.delegate} onPick={(n) => { api.delegate(task.id, n); onClose(); }} />
            {task.status !== 'backlog' && <button className="td-pill" onClick={() => { api.moveToBacklog(task.id); onClose(); }}>{t.detail.backlog}</button>}
          </>
        )}
        {confirmDelete ? (
          <>
            <span className="rg-small">{t.attention.confirmDelete}</span>
            <button className="td-pill td-pill--danger" onClick={() => { api.remove(task.id); onClose(); }}>{t.attention.yes}</button>
            <button className="td-pill" onClick={() => setConfirmDelete(false)}>{t.attention.no}</button>
          </>
        ) : (
          <button className="td-pill" onClick={() => setConfirmDelete(true)}>{t.dialog.delete}</button>
        )}
      </div>

      <div className="td-modal__foot">
        <span className="td-modal__spacer" />
        <button className="rg-btn rg-btn--glass" onClick={onClose}>{t.dialog.cancel}</button>
        <button className="rg-btn" onClick={() => void save()} disabled={!f.title.trim()}>{t.dialog.save}</button>
      </div>
    </Modal>
  );
}
