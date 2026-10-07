import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Small popover anchored to its trigger. Closes on outside click and Escape. */
export function Popover({
  trigger,
  children,
  align = 'right',
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="td-pop" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={`td-pop__panel td-pop__panel--${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="td-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`rg-card td-modal td-modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="td-modal__head">
          <h2 className="rg-h2">{title}</h2>
          <button className="rg-icon-btn rg-icon-btn--glass td-icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div className="td-toast" role="status" aria-live="polite" data-show={message ? 'true' : 'false'}>
      {message}
    </div>
  );
}
