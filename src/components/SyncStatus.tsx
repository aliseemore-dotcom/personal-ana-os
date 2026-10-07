import { RefreshCw } from 'lucide-react';
import { config } from '../config';
import { useSync } from '../state/RepoContext';
import { t } from '../strings';

/** "Last synced 14:32 · Refresh", and a calm line when the source could not be reached. */
export function SyncStatus() {
  const sync = useSync();
  if (!sync) return null;
  const { status, refresh } = sync;
  const time = status.syncedAt ? new Date(status.syncedAt).toLocaleTimeString(config.locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
  return (
    <div className="td-sync" data-stale={status.stale}>
      <span className="rg-small" aria-live="polite">
        {status.stale ? t.sync.stale : time ? t.sync.last(time) : t.sync.waiting}
      </span>
      <button className="td-link td-sync__btn" onClick={() => void refresh()} disabled={status.refreshing} aria-label={t.sync.refresh}>
        <RefreshCw size={14} className={status.refreshing ? 'td-spin' : undefined} /> {t.sync.refresh}
      </button>
      {!status.writable && <span className="rg-small rg-muted">{t.sync.readOnly}</span>}
    </div>
  );
}
