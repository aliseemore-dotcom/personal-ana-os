import { useState } from 'react';
import { ChevronDown, ChevronRight, MoveRight } from 'lucide-react';
import { calendarDaysBetween } from '../../domain/dates';
import type { InboxItem, Task, TaskStatus } from '../../domain/types';
import { classify, idleSince } from '../../logic/attention';
import { DEFAULT_THRESHOLDS } from '../../logic/thresholds';
import { t } from '../../strings';
import { Popover } from '../ui';

export type ItemRef = { kind: 'task' | 'capture'; id: string };

const COLUMNS: TaskStatus[] = ['inbox', 'backlog', 'planned', 'in_progress', 'waiting', 'done'];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const DONE_LIMIT = 30;

function sortCards(list: Task[], now: Date, status: TaskStatus): Task[] {
  if (status === 'done') return [...list].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  const overdue = (x: Task) => (x.deadline && new Date(x.deadline) < now ? 0 : 1);
  return [...list].sort(
    (a, b) =>
      overdue(a) - overdue(b) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.deadline ?? '9').localeCompare(b.deadline ?? '9') ||
      a.created_at.localeCompare(b.created_at),
  );
}

function MoveMenu({ current, onMove, label }: { current: TaskStatus; onMove: (to: TaskStatus) => void; label: string }) {
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button className="rg-icon-btn rg-icon-btn--glass td-icon-sm tk-card__menu" onClick={toggle} aria-expanded={open} aria-label={`${t.board.moveMenu}: ${label}`} title={t.board.moveMenu}>
          <MoveRight />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="rg-label tk-menu__head">{t.board.moveTo}</p>
          {COLUMNS.filter((s) => s !== current).map((s) => (
            <button key={s} className="td-menu__item" role="menuitem" onClick={() => (onMove(s), close())}>
              {t.board.columns[s]}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}

function Indicator({ task, now }: { task: Task; now: Date }) {
  const c = classify(task, now, DEFAULT_THRESHOLDS);
  if (task.status === 'done') return null;
  if (c?.kind === 'waiting') return <span className="rg-tag rg-tag--warning tk-tag-xs"><span className="rg-tag__dot" />{t.board.waitingFor(calendarDaysBetween(idleSince(task), now))}</span>;
  if (c?.kind === 'lost_attention') return <span className="rg-tag rg-tag--warning tk-tag-xs"><span className="rg-tag__dot" />{t.board.idle(c.days)}</span>;
  if (c?.kind === 'stale_backlog') return <span className="rg-tag tk-tag-xs">{t.board.inBacklog(c.days)}</span>;
  return null;
}

function Card({ task, now, project, onOpen, onMove, onDragStart, onDragEnd }: { task: Task; now: Date; project: string; onOpen: () => void; onMove: (to: TaskStatus) => void; onDragStart: () => void; onDragEnd: () => void }) {
  const overdue = task.status !== 'done' && task.deadline && new Date(task.deadline) < now;
  return (
    <li
      className="tk-card"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      data-priority={task.priority}
      data-done={task.status === 'done'}
    >
      <div className="tk-card__top">
        <button className="tk-card__title" onClick={onOpen}>{task.title}</button>
        <MoveMenu current={task.status} onMove={onMove} label={task.title} />
      </div>
      {project && <p className="rg-small tk-card__project">{project}</p>}
      <div className="tk-card__meta">
        <span className="tk-prio"><span className={`rg-dot rg-dot--sm${task.priority === 'high' ? ' rg-dot--rose' : ''}`} style={task.priority === 'low' ? { opacity: 0.45 } : undefined} />{t.priorities[task.priority]}</span>
        {task.deadline && task.status !== 'done' && (
          <span className={`rg-small${overdue ? ' tk-overdue' : ''}`}>
            {overdue ? t.overdueTag(Math.max(1, calendarDaysBetween(new Date(task.deadline), now))) : t.board.deadline(task.deadline)}
          </span>
        )}
        {task.estimated_duration && <span className="rg-small">{t.minutes(task.estimated_duration)}</span>}
        {task.delegated_to && <span className="rg-small">{t.board.delegatedTo(task.delegated_to)}</span>}
      </div>
      <Indicator task={task} now={now} />
    </li>
  );
}

function CaptureCard({ item, now, onMove, onDragStart, onDragEnd }: { item: InboxItem; now: Date; onMove: (to: TaskStatus) => void; onDragStart: () => void; onDragEnd: () => void }) {
  const days = calendarDaysBetween(new Date(item.created_at), now);
  return (
    <li className="tk-card tk-card--capture" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(); }} onDragEnd={onDragEnd}>
      <div className="tk-card__top">
        <p className="tk-card__title tk-card__title--static">{item.content}</p>
        <MoveMenu current="inbox" onMove={onMove} label={item.content} />
      </div>
      <div className="tk-card__meta">
        <span className="rg-tag tk-tag-xs">{t.board.capture}</span>
        <span className="rg-small">{days === 0 ? 'Today' : `${days} d ago`}</span>
      </div>
    </li>
  );
}

export function Board({
  tasks, captures, now, projectName, wipLimit, wipCount, onMove, onOpen, empty,
}: {
  tasks: Task[];
  captures: InboxItem[];
  now: Date;
  projectName: (id: string | null) => string;
  wipLimit: number;
  wipCount: number;
  onMove: (ref: ItemRef, to: TaskStatus) => void;
  onOpen: (id: string) => void;
  empty: boolean;
}) {
  const [drag, setDrag] = useState<ItemRef | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [doneOpen, setDoneOpen] = useState(() => {
    try { return localStorage.getItem('personal-os:done-open') === '1'; } catch { return false; }
  });
  const [doneAll, setDoneAll] = useState(false);
  const toggleDone = () => setDoneOpen((v) => {
    try { localStorage.setItem('personal-os:done-open', v ? '0' : '1'); } catch { /* optional */ }
    return !v;
  });

  const drop = (to: TaskStatus) => {
    if (drag) onMove(drag, to);
    setDrag(null);
    setOver(null);
  };

  return (
    <div className="tk-board" role="group" aria-label={t.board.title}>
      {COLUMNS.map((status) => {
        const list = sortCards(tasks.filter((x) => x.status === status), now, status);
        const caps = status === 'inbox' ? captures : [];
        const count = list.length + caps.length;
        const isDone = status === 'done';
        const collapsed = isDone && !doneOpen;
        const overLimit = status === 'in_progress' && wipCount > wipLimit;
        const atLimit = status === 'in_progress' && wipCount === wipLimit;
        const cards = isDone && !doneAll ? list.slice(0, DONE_LIMIT) : list;

        return (
          <section
            key={status}
            className="tk-col"
            data-status={status}
            data-collapsed={collapsed}
            data-over={over === status}
            data-drag={drag !== null}
            aria-label={t.board.columns[status]}
            onDragOver={(e) => { if (drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
            onDragEnter={() => drag && setOver(status)}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === status ? null : o)); }}
            onDrop={(e) => { e.preventDefault(); drop(status); }}
          >
            <header className="tk-col__head">
              {isDone ? (
                <button className="tk-col__toggle" onClick={toggleDone} aria-expanded={doneOpen} title={doneOpen ? t.board.doneCollapse : t.board.doneExpand}>
                  {doneOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <h3 className="rg-label">{t.board.columns[status]}</h3>
                </button>
              ) : (
                <h3 className="rg-label">{t.board.columns[status]}</h3>
              )}
              <span className={`rg-count rg-count--sm${overLimit ? ' rg-count--warning' : ''}`}>{count}</span>
              {status === 'in_progress' && (
                <span className={`rg-tag ${overLimit || atLimit ? 'rg-tag--warning' : ''} tk-tag-xs`} title={`${t.wip.cancel}`}>
                  {overLimit || atLimit ? <span className="rg-tag__dot" /> : null}
                  {t.board.wip(wipCount, wipLimit)}{overLimit ? ` · ${t.board.overLimit}` : atLimit ? ` · ${t.board.atLimit}` : ''}
                </span>
              )}
            </header>

            {!collapsed && (
              <ul className="tk-col__list">
                {caps.map((c) => (
                  <CaptureCard key={c.id} item={c} now={now} onMove={(to) => onMove({ kind: 'capture', id: c.id }, to)} onDragStart={() => setDrag({ kind: 'capture', id: c.id })} onDragEnd={() => { setDrag(null); setOver(null); }} />
                ))}
                {cards.map((task) => (
                  <Card key={task.id} task={task} now={now} project={projectName(task.project_id)} onOpen={() => onOpen(task.id)} onMove={(to) => onMove({ kind: 'task', id: task.id }, to)} onDragStart={() => setDrag({ kind: 'task', id: task.id })} onDragEnd={() => { setDrag(null); setOver(null); }} />
                ))}
                {count === 0 && <li className="tk-col__empty">{drag ? t.board.dropHere : empty ? t.board.noResults : t.board.emptyColumn}</li>}
                {isDone && !doneAll && list.length > DONE_LIMIT && (
                  <li><button className="td-link" onClick={() => setDoneAll(true)}>{t.board.showAll(list.length - DONE_LIMIT)}</button></li>
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
