import { useCallback, useEffect, useState } from 'react';
import type { Repository } from '../data';
import { questionFor } from '../content/dailyQuestions';
import { dateKey } from '../domain/dates';

/** The question is fixed for the local calendar day; the answer is stored with date + question. */
export function useDailyQuestion(repo: Repository, now: Date) {
  const day = dateKey(now);
  const [fromSource, setFromSource] = useState<string | null>(null);
  // The question comes from the Data Hub when it has one for today; otherwise the built-in set.
  const question = fromSource ?? questionFor(now);
  const [saved, setSaved] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setFromSource(null);
    if (repo.getDailyQuestion) {
      const load = () => void repo.getDailyQuestion!(day).then((q) => alive && setFromSource(q)).catch(() => undefined);
      load();
      const off = repo.sync?.onData(load);
      return () => { alive = false; off?.(); };
    }
    return () => { alive = false; };
  }, [repo, day]);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    repo
      .getDailyAnswer(day)
      .then((a) => alive && setSaved(a?.answer ?? null))
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [repo, day]);

  const save = useCallback(
    async (answer: string) => {
      await repo.saveDailyAnswer({ date: day, question, answer });
      setSaved(answer);
    },
    [repo, day, question],
  );

  return { question, saved, loaded, save };
}
