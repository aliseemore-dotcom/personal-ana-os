import { useState } from 'react';
import { dateKey, endOfDay, fromDateKey } from '../../domain/dates';
import type { Priority, Task, TaskStatus } from '../../domain/types';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { Modal } from '../ui';

const STATUSES: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'waiting', 'done'];

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const api = useTasks();
  const [f, setF] = useState({
    title: task.title,
    description: task.description ?? '',
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

  const save = () => {
    if (!f.title.trim()) return;
    const finished = f.status === 'done' && task.status !== 'done';
    api.edit(task.id, {
      title: f.title.trim(),
      description: f.description.trim() || null,
      status: f.status,
      priority: f.priority,
      deadline: f.deadline ? endOfDay(fromDateKey(f.deadline)).toISOString() : null,
      scheduled_date: f.scheduled || null,
      estimated_duration: Number(f.duration) > 0 ? Math.round(Number(f.duration)) : null,
      impact_score: Math.min(10, Math.max(1, Math.round(Number(f.impact)) || 5)),
      blocks_others: f.blocks,
      blocks_note: f.blocks ? f.blocksNote.trim() || null : null,
      completed_at: f.status === 'done' ? task.completed_at ?? new Date().toISOString() : null,
      ...(finished || f.status === 'done' ? { is_focus: false } : {}),
    });
    onClose();
  };

  return (
    <Modal title={t.dialog.title} onClose={onClose}>
      <div className="td-form">
        <label className="td-field td-field--wide">
          <span className="rg-label">{t.dialog.name}</span>
          <input className="td-input" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </label>
        <label className="td-field td-field--wide">
          <span className="rg-label">{t.dialog.description}</span>
          <textarea className="td-input td-input--area" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </label>
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
          <span className="rg-label">{t.dialog.scheduled}</span>
          <input className="td-input" type="date" value={f.scheduled} onChange={(e) => set('scheduled', e.target.value)} />
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.deadline}</span>
          <input className="td-input" type="date" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </label>
        <label className="td-field">
          <span className="rg-label">{t.dialog.duration}</span>
          <input className="td-input" type="number" min={1} step={5} value={f.duration} onChange={(e) => set('duration', e.target.value)} />
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
      </div>
      <div className="td-modal__foot">
        {confirmDelete ? (
          <span className="td-att__actions">
            <span className="rg-small">{t.attention.confirmDelete}</span>
            <button className="td-pill td-pill--danger" onClick={() => (api.remove(task.id), onClose())}>{t.attention.yes}</button>
            <button className="td-pill" onClick={() => setConfirmDelete(false)}>{t.attention.no}</button>
          </span>
        ) : (
          <button className="td-pill" onClick={() => setConfirmDelete(true)}>{t.dialog.delete}</button>
        )}
        <span className="td-modal__spacer" />
        <button className="rg-btn rg-btn--glass" onClick={onClose}>{t.dialog.cancel}</button>
        <button className="rg-btn" onClick={save} disabled={!f.title.trim()}>{t.dialog.save}</button>
      </div>
    </Modal>
  );
}
