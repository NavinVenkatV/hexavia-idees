import { useEffect } from 'react';
import { formatEuros } from '../domain/normalize';
import { finalNote, isModified, totalScore } from '../domain/scoring';
import type { AppState, Action } from '../state/store';
import { Icon } from './Icon';
import { Score, StatutBadge, statutOf } from './ui';

interface Props {
  state: AppState;
  ideaId: string;
  dispatch: (a: Action) => void;
  onClose: () => void;
  onValidate: (titre: string) => void;
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
  onPropose: () => void;
  proposing: boolean;
}

export function IdeaPanel({ state, ideaId, dispatch, onClose, onValidate, onNext, onPrev, onPropose, proposing }: Props) {
  const idea = state.ideas.find((i) => i.id === ideaId);
  const ev = state.evaluations[ideaId];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  if (!idea) return null;
  const total = totalScore(ev, state.config);
  const doublonDe = state.doublonDe[idea.id];
  const complete = total !== null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Idée ${idea.id}`}>
        <div className="drawer-head">
          <div style={{ flex: 1 }}>
            <div className="row wrap" style={{ marginBottom: 4 }}>
              <span className="id">{idea.id}</span>
              <StatutBadge statut={statutOf(ev)} />
              {doublonDe && <span className="badge badge-warn">Doublon de {doublonDe}</span>}
            </div>
            <h2 style={{ fontSize: '1.15rem' }}>{idea.titre}</h2>
          </div>
          <div className="total-box">
            <div className="tiny">Note globale</div>
            <Score value={total} large />
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer (Échap)"><Icon name="x" size={18} /></button>
        </div>

        <div className="drawer-body">
          <dl className="meta">
            <dt>Auteur</dt><dd>{`${idea.prenom} ${idea.nom}`.trim() || '—'}</dd>
            <dt>Direction</dt><dd>{idea.direction || '—'}{idea.site ? ` · ${idea.site}` : ''}</dd>
            <dt>Thème</dt><dd>{idea.theme || '—'}</dd>
            <dt>Budget estimé</dt>
            <dd>
              {idea.budgetEur !== null ? formatEuros(idea.budgetEur) : 'Non chiffré'}
              {idea.budgetBrut && idea.budgetBrut.replace(/\s/g, '') !== formatEuros(idea.budgetEur).replace(/\s/g, '') && (
                <span className="tiny"> (saisi : « {idea.budgetBrut} »)</span>
              )}
            </dd>
            <dt>Déposée le</dt><dd>{idea.dateDepot ? new Date(idea.dateDepot).toLocaleDateString('fr-FR') : idea.dateBrute || '—'}</dd>
          </dl>

          <div>
            <div className="section-title">Description</div>
            <p className="prose">{idea.description || <span className="muted">Pas de description.</span>}</p>
          </div>
          <div>
            <div className="section-title">Bénéfices attendus</div>
            <p className="prose">{idea.benefices || <span className="muted">Non renseignés.</span>}</p>
          </div>

          <div className="stack">
            <div className="row">
              <div className="section-title" style={{ margin: 0 }}>Évaluation</div>
              <span className="spacer" />
              {!ev?.ai && (
                <button className="btn btn-ai btn-sm" onClick={onPropose} disabled={proposing}>
                  <Icon name="sparkles" size={14} /> {proposing ? 'Proposition en cours…' : 'Proposer une note'}
                </button>
              )}
            </div>
            {ev?.ai && (
              <p className="tiny legend">
                <span className="legend-dot ai" /> Note proposée{ev.ai.source === 'simulation' ? ' (simulation)' : ''}
                <span className="legend-dot you" /> Votre note · cliquez sur une valeur pour corriger
              </p>
            )}
            {state.config.criteres.map((c) => {
              const ai = ev?.ai?.notes[c.id];
              const current = finalNote(ev, c.id);
              const modified = isModified(ev, c.id);
              return (
                <div className="criterion" key={c.id}>
                  <div className="criterion-head">
                    <h3>{c.label}</h3>
                    <span className="muted small">{c.question}</span>
                    <span className="spacer" />
                    {modified && (
                      <button className="link small" onClick={() => dispatch({ type: 'note', ideaId: idea.id, critere: c.id, note: undefined })}>
                        <Icon name="undo" size={13} /> Revenir à la proposition ({ai})
                      </button>
                    )}
                  </div>
                  <div className="scale" role="radiogroup" aria-label={c.label}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        role="radio"
                        aria-checked={current === n}
                        className={`${current === n ? 'selected' : ''} ${ai === n ? 'ai' : ''} ${current === n && ev?.manuelles[c.id] === undefined ? 'from-ai' : ''}`}
                        title={ai === n ? "Note proposée par l'IA" : undefined}
                        onClick={() => dispatch({ type: 'note', ideaId: idea.id, critere: c.id, note: n === ai ? undefined : n })}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {ev?.ai && (
                    <div className="justif">
                      <Icon name="sparkles" size={13} />
                      <span><strong>Proposition : {ai}/5.</strong> {ev.ai.justifications[c.id]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="section-title" htmlFor="commentaire">Votre commentaire (repris dans la shortlist)</label>
            <textarea
              id="commentaire"
              className="input"
              placeholder="Ex. : à rapprocher de l'idée IDEA-012, porteur très motivé…"
              value={ev?.commentaire ?? ''}
              onChange={(e) => dispatch({ type: 'commentaire', ideaId: idea.id, texte: e.target.value })}
            />
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn btn-icon" onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="Idée précédente" title="Idée précédente (←)"><Icon name="chevronLeft" size={18} /></button>
          <button className="btn btn-icon" onClick={onNext ?? undefined} disabled={!onNext} aria-label="Idée suivante" title="Idée suivante (→)"><Icon name="chevronRight" size={18} /></button>
          <span className="tiny hide-sm">← → pour naviguer · Échap pour fermer</span>
          <span className="spacer" />
          {ev?.validee ? (
            <button className="btn" onClick={() => dispatch({ type: 'valider', ideaId: idea.id, validee: false })}><Icon name="undo" size={15} /> Rouvrir</button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!complete}
              title={complete ? undefined : 'Notez les quatre critères pour valider'}
              onClick={() => {
                dispatch({ type: 'valider', ideaId: idea.id, validee: true });
                onValidate(idea.titre);
                onNext?.();
              }}
            >
              <Icon name="check" size={16} /> Valider{onNext ? ' et passer à la suivante' : ''}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
