import type { Route } from '../state/useRoute';
import { t } from '../strings';
import { SyncStatus } from './SyncStatus';

const ROUTES: Route[] = ['today', 'tasks', 'projects'];

export function AppNav({ route, onNavigate }: { route: Route; onNavigate: (hash: string) => void }) {
  return (
    <div className="td-topbar">
      <nav className="rg-tabs td-nav" role="tablist" aria-label={t.nav.label}>
        {ROUTES.map((r) => (
          <button key={r} className="rg-tab" role="tab" aria-selected={route === r} onClick={() => onNavigate(r)}>
            {t.nav[r]}
          </button>
        ))}
      </nav>
      <SyncStatus />
    </div>
  );
}
