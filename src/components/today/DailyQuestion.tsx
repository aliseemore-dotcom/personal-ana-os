import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Repository } from '../../data';
import { useDailyQuestion } from '../../state/useDailyQuestion';
import { t } from '../../strings';

export function DailyQuestion({ repo, now, onError }: { repo: Repository; now: Date; onError: (m: string) => void }) {
  const { question, saved, loaded, save } = useDailyQuestion(repo, now);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(saved ?? ''), [saved, question]);

  const dirty = draft.trim() !== (saved ?? '');
  const submit = async () => {
    if (!draft.trim() || !dirty) return;
    setBusy(true);
    try {
      await save(draft.trim());
    } catch {
      onError(t.errors.save);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rg-glass td-question" aria-labelledby="q-title">
      <h2 className="rg-label" id="q-title">{t.question.title}</h2>
      <p className="td-question__text">{question}</p>
      <label className="rg-input td-question__input">
        <span className="rg-input__icon"><Pencil /></span>
        <input
          value={draft}
          disabled={!loaded}
          placeholder={t.question.placeholder}
          aria-label={question}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <button className="rg-input__action" onClick={() => void submit()} disabled={busy || !draft.trim() || !dirty}>
          {busy ? '…' : t.question.save}
        </button>
      </label>
      <p className="rg-small td-question__state" aria-live="polite">
        {saved !== null && !dirty ? t.question.saved : dirty && draft ? t.question.edited : ' '}
      </p>
    </section>
  );
}
