import { useMemo, useState } from 'react';
import { proposeAll, AI_MODE } from '../ai/propose';
import { normalizeText } from '../domain/normalize';
import { totalScore } from '../domain/scoring';
import type { AppState, Action } from '../state/store';
import { IdeaPanel } from './IdeaPanel';
import { Empty, Score, STATUT_LABEL, StatutBadge, statutOf, type Statut } from './ui';

type Sort = 'id' | 'note';

export function IdeasScreen({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const [q, setQ] = useState('');
  const [direction, setDirection] = useState('');
  const [theme, setTheme] = useState('');
  const [site, setSite] = useState('');
  const [statut, setStatut] = useState<Statut | ''>('');
  const [sort, setSort] = useState<Sort>('id');
  const [openId, setOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [hideImportBanner, setHideImportBanner] = useState(false);

  const options = (f: 'direction' | 'theme' | 'site') =>
    [...new Set(state.ideas.map((i) => i[f]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));

  const filtered = useMemo(() => {
    const nq = normalizeText(q);
    const list = state.ideas.filter(
      (i) =>
        (!direction || i.direction === direction) &&
        (!theme || i.theme === theme) &&
        (!site || i.site === site) &&
        (!statut || statutOf(state.evaluations[i.id]) === statut) &&
        (!nq || normalizeText(`${i.id} ${i.titre} ${i.description} ${i.prenom} ${i.nom}`).includes(nq)),
    );
    if (sort === 'note') {
      list.sort((a, b) => (totalScore(state.evaluations[b.id], state.config) ?? -1) - (totalScore(state.evaluations[a.id], state.config) ?? -1));
    }
    return list;
  }, [state, q, direction, theme, site, statut, sort]);

  const sansProposition = state.ideas.filter((i) => !state.evaluations[i.id]?.ai);
  const validees = state.ideas.filter((i) => state.evaluations[i.id]?.validee).length;
  const filtersActive = q || direction || theme || site || statut;

  async function run(ideas = sansProposition) {
    if (!ideas.length) return;
    setAiError(null);
    setProgress({ done: 0, total: ideas.length });
    const failed = await proposeAll(
      ideas,
      state.config,
      (ideaId, proposal) => dispatch({ type: 'proposal', ideaId, proposal }),
      (done) => setProgress({ done, total: ideas.length }),
    );
    setProgress(null);
    if (failed) setAiError(`${failed} idée${failed > 1 ? 's' : ''} n'${failed > 1 ? 'ont' : 'a'} pas pu recevoir de proposition. Vous pouvez relancer ou les noter vous-même.`);
  }

  const idx = openId ? filtered.findIndex((i) => i.id === openId) : -1;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Idées déposées</h2>
          <p className="muted lead">
            {validees} sur {state.ideas.length} validées
          </p>
        </div>
        <span className="spacer" />
        {sansProposition.length > 0 && (
          <button className="btn btn-ai" onClick={() => run()} disabled={!!progress}>
            ✨ Proposer les notes pour {sansProposition.length === state.ideas.length ? 'toutes les idées' : `${sansProposition.length} idée${sansProposition.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      <div className="progress" style={{ marginBottom: 16 }} aria-label="Avancement de la validation">
        <div style={{ width: `${(validees / Math.max(1, state.ideas.length)) * 100}%` }} />
      </div>

      {!hideImportBanner && state.fichier && (
        <div className="banner banner-ok">
          <span aria-hidden>✓</span>
          <div style={{ flex: 1 }}>
            <strong>{state.ideas.length} idées importées</strong> depuis « {state.fichier.nom} ».
            {state.warnings.length > 0 && (
              <>
                {' '}{state.warnings.length} point{state.warnings.length > 1 ? 's' : ''} corrigé{state.warnings.length > 1 ? 's' : ''} automatiquement.{' '}
                <button className="link" onClick={() => setShowWarnings((v) => !v)}>{showWarnings ? 'Masquer' : 'Voir le détail'}</button>
                {showWarnings && (
                  <ul className="small">
                    {state.warnings.map((w, i) => (
                      <li key={i}>{w.ligne ? `Ligne ${w.ligne} : ` : ''}{w.message}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setHideImportBanner(true)} aria-label="Masquer">✕</button>
        </div>
      )}

      {progress && (
        <div className="banner banner-info" role="status">
          <div style={{ flex: 1 }}>
            <div className="small" style={{ marginBottom: 6 }}>
              Proposition des notes… {progress.done} / {progress.total}
              {AI_MODE === 'simulation' && <span className="tiny"> · mode simulation, aucune donnée envoyée</span>}
            </div>
            <div className="progress ai"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          </div>
        </div>
      )}
      {aiError && (
        <div className="banner banner-warn" role="alert">
          <span aria-hidden>⚠️</span>
          <span style={{ flex: 1 }}>{aiError}</span>
          <button className="btn btn-sm" onClick={() => run()}>Relancer</button>
        </div>
      )}

      <div className="toolbar">
        <input className="input search" type="search" placeholder="Rechercher (mot, auteur, n°)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <select className="select" value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Direction">
          <option value="">Toutes les directions</option>
          {options('direction').map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="select" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Thème">
          <option value="">Tous les thèmes</option>
          {options('theme').map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="select" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site">
          <option value="">Tous les sites</option>
          {options('site').map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="select" value={statut} onChange={(e) => setStatut(e.target.value as Statut | '')} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUT_LABEL) as Statut[]).map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
        </select>
        {filtersActive && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setDirection(''); setTheme(''); setSite(''); setStatut(''); }}>
            Effacer les filtres
          </button>
        )}
        <span className="spacer" />
        <span className="small muted">{filtered.length} idée{filtered.length > 1 ? 's' : ''}</span>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {filtered.length === 0 ? (
          <Empty icon="🔍" title="Aucune idée ne correspond à ces filtres">
            <button className="link" onClick={() => { setQ(''); setDirection(''); setTheme(''); setSite(''); setStatut(''); }}>Effacer les filtres</button>
          </Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th><button className="th-sort" onClick={() => setSort('id')}>Idée {sort === 'id' ? '↓' : ''}</button></th>
                <th className="hide-sm">Direction</th>
                <th className="hide-sm">Thème</th>
                <th>Statut</th>
                <th className="num"><button className="th-sort" onClick={() => setSort('note')}>Note {sort === 'note' ? '↓' : ''}</button></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const ev = state.evaluations[i.id];
                return (
                  <tr key={i.id} className={openId === i.id ? 'selected' : ''} onClick={() => setOpenId(i.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(i.id)}>
                    <td>
                      <div className="idea-title">{i.titre}</div>
                      <div className="row wrap">
                        <span className="id">{i.id}</span>
                        {state.doublonDe[i.id] && <span className="badge badge-warn">Doublon de {state.doublonDe[i.id]}</span>}
                        {state.forcees[i.id] === 'in' && <span className="badge badge-ok">Retenue d'office</span>}
                      </div>
                    </td>
                    <td className="hide-sm small">{i.direction}<div className="tiny">{i.site}</div></td>
                    <td className="hide-sm small">{i.theme}</td>
                    <td><StatutBadge statut={statutOf(ev)} /></td>
                    <td className="num"><Score value={totalScore(ev, state.config)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openId && (
        <IdeaPanel
          state={state}
          ideaId={openId}
          dispatch={dispatch}
          onClose={() => setOpenId(null)}
          onNext={idx >= 0 && idx < filtered.length - 1 ? () => setOpenId(filtered[idx + 1].id) : null}
          onPrev={idx > 0 ? () => setOpenId(filtered[idx - 1].id) : null}
          onPropose={() => {
            const idea = state.ideas.find((x) => x.id === openId);
            if (idea) run([idea]);
          }}
          proposing={!!progress}
        />
      )}
    </>
  );
}
