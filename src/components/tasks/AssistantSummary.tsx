import type { Summary } from '../../logic/summary';
import { t } from '../../strings';

export function AssistantSummary({ summary }: { summary: Summary }) {
  const x = t.tasksPage;
  return (
    <section className="rg-glass tk-summary" aria-labelledby="sum-title">
      <h2 className="rg-label" id="sum-title">{x.summary}</h2>
      <p className="tk-summary__lead">{x.active(summary.active)}</p>
      {summary.observations.length === 0 ? (
        <p className="tk-summary__calm">{x.calm}</p>
      ) : (
        <ul className="tk-obs">
          {summary.observations.map((o) => (
            <li key={o.code} className="tk-obs__item" data-tone={o.tone}>
              <span className="tk-obs__dot" aria-hidden />
              {x.observation(o)}
            </li>
          ))}
        </ul>
      )}
      {summary.recommendation && (
        <div className="tk-reco">
          <p className="rg-label">{x.recommended}</p>
          <p className="tk-reco__text">{x.recommendation(summary.recommendation)}</p>
        </div>
      )}
    </section>
  );
}
