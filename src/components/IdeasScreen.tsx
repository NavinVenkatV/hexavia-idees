import { useMemo, useState } from 'react';
import { proposeAll, AI_MODE } from '../ai/propose';
import { normalizeText } from '../domain/normalize';
import { finalNote, totalScore } from '../domain/scoring';
import { pairKey } from '../domain/duplicates';
import type { AppState, Action } from '../state/store';
import { Icon } from './Icon';
import { IdeaPanel } from './IdeaPanel';
import type { Tab } from './Sidebar';
import { useToast } from './Toast';
import { CriteriaBars, Empty, Score, STATUT_LABEL, StatutBadge, statutOf, type Statut } from './ui';

type Sort = 'id' | 'note';

export function IdeasScreen({ state, dispatch, goTo }: { state: AppState; dispatch: (a: Action) => void; goTo: (t: Tab) => void }) {
  const toast = useToast();
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
  const aRelire = state.ideas.filter((i) => statutOf(state.evaluations[i.id]) === 'proposee').length;
  const totals = state.ideas.map((i) => totalScore(state.evaluations[i.id], state.config)).filter((t): t is number => t !== null);
  const moyenne = totals.length ? totals.reduce((s, t) => s + t, 0) / totals.length : null;
  const doublons = state.paires.filter((p) => !state.decisions[pairKey(p.a, p.b)]).length;
  const pct = Math.round((validees / Math.max(1, state.ideas.length)) * 100);
  const clearFilters = () => { setQ(''); setDirection(''); setTheme(''); setSite(''); setStatut(''); };

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
    if (ideas.length - failed > 0) toast(`${ideas.length - failed} note${ideas.length - failed > 1 ? 's' : ''} proposée${ideas.length - failed > 1 ? 's' : ''}. À vous de relire.`);
    if (failed) setAiError(`${failed} idée${failed > 1 ? 's' : ''} n'${failed > 1 ? 'ont' : 'a'} pas pu recevoir de proposition. Vous pouvez relancer ou les noter vous-même.`);
  }

  const idx = openId ? filtered.findIndex((i) => i.id === openId) : -1;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Étape 1 sur 3</div>
          <h2>Idées déposées</h2>
          <p className="muted lead">Relisez chaque idée, ajustez la note proposée, puis validez.</p>
        </div>
        <span className="spacer" />
        {sansProposition.length > 0 && (
          <button className="btn btn-ai btn-lg" onClick={() => run()} disabled={!!progress}>
            <Icon name="sparkles" size={17} />
            Proposer les notes pour {sansProposition.length === state.ideas.length ? 'toutes les idées' : `${sansProposition.length} idée${sansProposition.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Idées déposées</div>
          <div className="stat-value">{state.ideas.length}</div>
          <div className="stat-foot">{options('direction').length} directions · {options('theme').length} thèmes</div>
        </div>
        <button className="stat stat-click" onClick={() => setStatut(statut === 'proposee' ? '' : 'proposee')} aria-pressed={statut === 'proposee'}>
          <div className="stat-label">À relire</div>
          <div className="stat-value ai">{aRelire}</div>
          <div className="stat-foot">{statut === 'proposee' ? 'Filtre actif' : 'Cliquer pour filtrer'}</div>
        </button>
        <div className="stat">
          <div className="stat-label">Validées</div>
          <div className="stat-value ok">{validees}<span className="stat-of">/{state.ideas.length}</span></div>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="stat">
          <div className="stat-label">Note moyenne</div>
          <div className="stat-value">{moyenne === null ? '–' : moyenne.toFixed(1).replace('.', ',')}<span className="stat-of">/5</span></div>
          <div className="stat-foot">{totals.length} idée{totals.length > 1 ? 's' : ''} notée{totals.length > 1 ? 's' : ''}</div>
        </div>
        <button className="stat stat-click" onClick={() => goTo('doublons')}>
          <div className="stat-label">Doublons à examiner</div>
          <div className={`stat-value ${doublons ? 'warn' : 'ok'}`}>{doublons}</div>
          <div className="stat-foot">{doublons ? 'Voir les paires →' : 'Tout est examiné'}</div>
        </button>
      </div>

      {!hideImportBanner && state.fichier && (
        <div className="banner banner-ok">
          <span className="banner-icon"><Icon name="check" size={16} /></span>
          <div style={{ flex: 1 }}>
            <strong>{state.ideas.length} idées importées</strong> depuis « {state.fichier.nom} ».
            {state.warnings.length > 0 && (
              <>
                {' '}{state.warnings.length} point{state.warnings.length > 1 ? 's' : ''} à connaître sur le fichier.{' '}
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
          <button className="icon-btn" onClick={() => setHideImportBanner(true)} aria-label="Masquer"><Icon name="x" size={16} /></button>
        </div>
      )}

      {progress && (
        <div className="banner banner-info" role="status">
          <span className="banner-icon spin"><Icon name="sparkles" size={16} /></span>
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
          <span className="banner-icon"><Icon name="alert" size={16} /></span>
          <span style={{ flex: 1 }}>{aiError}</span>
          <button className="btn btn-sm" onClick={() => run()}><Icon name="refresh" size={14} /> Relancer</button>
        </div>
      )}

      <div className="toolbar">
        <div className="search-wrap">
          <Icon name="search" size={16} className="search-icon" />
          <input className="input search" type="search" placeholder="Rechercher une idée…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        </div>
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
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <Icon name="x" size={14} /> Effacer les filtres
          </button>
        )}
        <span className="spacer" />
        <span className="small muted">{filtered.length} idée{filtered.length > 1 ? 's' : ''}</span>
      </div>

      <div className="card table-card">
        {filtered.length === 0 ? (
          <Empty icon="search" title="Aucune idée ne correspond à ces filtres">
            <button className="link" onClick={clearFilters}>Effacer les filtres</button>
          </Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th><button className="th-sort" onClick={() => setSort('id')}>Idée {sort === 'id' ? '↓' : ''}</button></th>
                <th className="hide-sm">Direction</th>
                <th className="hide-sm">Thème</th>
                <th>Statut</th>
                <th className="hide-sm">Profil</th>
                <th className="num"><button className="th-sort" onClick={() => setSort('note')}>Note {sort === 'note' ? '↓' : ''}</button></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const ev = state.evaluations[i.id];
                return (
                  <tr key={i.id} className={`${openId === i.id ? 'selected' : ''} ${state.doublonDe[i.id] ? 'dimmed' : ''}`} onClick={() => setOpenId(i.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(i.id)}>
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
                    <td className="hide-sm"><CriteriaBars notes={state.config.criteres.map((c) => finalNote(ev, c.id))} labels={state.config.criteres.map((c) => c.label)} /></td>
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
          onValidate={(titre) => toast(`« ${titre} » validée.`)}
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
