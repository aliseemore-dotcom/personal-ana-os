import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { Repository, SyncStatus } from '../data/repository';

const Ctx = createContext<Repository | null>(null);

export function RepoProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  return <Ctx.Provider value={repo}>{children}</Ctx.Provider>;
}

const NONE: SyncStatus = { syncedAt: null, stale: false, refreshing: false, writable: true };
const noop = () => () => undefined;

/** The data source's sync status and the manual Refresh. `null` when the data is local (nothing to sync). */
export function useSync(): { status: SyncStatus; refresh: () => Promise<void> } | null {
  const repo = useContext(Ctx);
  const sync = repo?.sync;
  // A snapshot object per change: getStatus() returns a fresh copy, so cache by its JSON.
  const json = useSyncExternalStore(sync ? sync.subscribe : noop, () => (sync ? JSON.stringify(sync.getStatus()) : ''), () => '');
  if (!sync) return null;
  return { status: json ? (JSON.parse(json) as SyncStatus) : NONE, refresh: () => sync.refresh().catch(() => undefined) };
}
