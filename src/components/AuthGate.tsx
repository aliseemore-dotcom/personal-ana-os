import { useEffect, useState, type ReactNode } from 'react';
import { Mail } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../data';
import { t } from '../strings';

/**
 * With Supabase configured, Row Level Security needs a signed-in user.
 * Passwordless email link; without Supabase this gate is skipped entirely.
 */
export function AuthGate({ children }: { children: (signOut: () => void) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="rg rg-stage td-stage" />;
  if (session) return <>{children(() => void supabase?.auth.signOut())}</>;

  const send = async () => {
    setErr('');
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setErr(error.message);
    else setSent(true);
  };

  return (
    <div className="rg rg-stage td-stage td-center">
      <div className="rg-orb td-orb td-orb--a" aria-hidden />
      <section className="rg-glass td-auth">
        <h1 className="rg-h1">{t.auth.title}</h1>
        <p className="td-auth__body">{sent ? t.auth.sent : t.auth.body}</p>
        {!sent && (
          <label className="rg-input">
            <span className="rg-input__icon"><Mail /></span>
            <input type="email" value={email} placeholder={t.auth.email} aria-label={t.auth.email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && void send()} />
            <button className="rg-input__action" onClick={() => void send()} disabled={!email}>{t.auth.send}</button>
          </label>
        )}
        {err && <p className="rg-small" style={{ color: 'var(--danger-text)' }}>{err}</p>}
      </section>
    </div>
  );
}
