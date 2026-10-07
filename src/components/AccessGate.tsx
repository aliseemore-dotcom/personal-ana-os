import { useEffect, useState, type ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { getAccessKey, onAccessKeyChange, setAccessKey } from '../data/accessKey';
import { t } from '../strings';

/**
 * The Data Hub's API answers only to the access key. The key is typed here once and kept in this
 * browser; the real value lives only on the server.
 */
export function AccessGate({ children }: { children: (signOut: () => void) => ReactNode }) {
  const [key, setKey] = useState<string | null>(() => getAccessKey());
  const [draft, setDraft] = useState('');
  useEffect(() => onAccessKeyChange(() => setKey(getAccessKey())), []);

  if (key) return <>{children(() => setAccessKey(null))}</>;

  const submit = () => draft.trim() && setAccessKey(draft.trim());
  return (
    <div className="rg rg-stage td-stage td-center">
      <div className="rg-orb td-orb td-orb--a" aria-hidden />
      <section className="rg-glass td-auth">
        <h1 className="rg-h1">{t.access.title}</h1>
        <p className="td-auth__body">{t.access.body}</p>
        <label className="rg-input">
          <span className="rg-input__icon"><KeyRound /></span>
          <input type="password" autoComplete="current-password" value={draft} placeholder={t.access.placeholder} aria-label={t.access.placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button className="rg-input__action" onClick={submit} disabled={!draft.trim()}>{t.access.open}</button>
        </label>
      </section>
    </div>
  );
}
