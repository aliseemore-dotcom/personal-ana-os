import { useEffect, useRef, useState } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { useTasks } from '../../state/TasksProvider';
import { t } from '../../strings';
import { Modal } from '../ui';

export function QuickCapture() {
  const api = useTasks();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // "c" opens capture from anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const submit = () => {
    const content = text.trim();
    if (!content) return;
    // Optimistic: close at once; the shared store rolls back and tells the user only if saving fails.
    setText('');
    setOpen(false);
    api.notify(t.capture.saved);
    api.capture(content);
  };

  return (
    <>
      <button className="rg-icon-btn rg-btn--rose td-fab" onClick={() => setOpen(true)} aria-label={t.capture.open} title={`${t.capture.open} (C)`}>
        <Plus />
      </button>
      {open && (
        <Modal title={t.capture.title} onClose={() => setOpen(false)} size="sm">
          <label className="rg-input td-capture__input">
            <span className="rg-input__icon"><Inbox /></span>
            <input
              ref={input}
              value={text}
              placeholder={t.capture.placeholder}
              aria-label={t.capture.title}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>
          <div className="td-capture__foot">
            <span className="rg-small rg-muted">{t.capture.hint}</span>
            <button className="rg-btn" onClick={submit} disabled={!text.trim()}>{t.capture.save}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
