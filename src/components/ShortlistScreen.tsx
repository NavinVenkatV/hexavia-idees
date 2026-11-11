import { pairKey } from '../domain/duplicates';
import { shortlistToCsv } from '../domain/export';
import { formatEuros } from '../domain/normalize';
import { finalNote } from '../domain/scoring';
import { computeShortlist, type RankedIdea } from '../domain/shortlist';
import type { AppState, Action } from '../state/store';
import { Icon } from './Icon';
import type { Tab } from './Sidebar';
import { useToast } from './Toast';
import { Empty, Score } from './ui';

export function ShortlistScreen({ state, dispatch, goTo }: { state: AppState; dispatch: (a: Action) => void; goTo: (t: Tab) => void }) {
  const toast = useToast();
  const sl = computeShortlist(state.ideas, state.evaluations, state, state.config);
  const nonValidees = sl.retenues.filter((r) => !state.evaluations[r.idea.id]?.validee).length;
  const doublonsEnAttente = state.paires.filter((p) => !state.decisions[pairKey(p.a, p.b)]).length;
  const ecartees = state.ideas.filter((i) => state.forcees[i.id] === 'out');

  function download() {
    const csv = shortlistToCsv(sl.retenues, state.evaluations, state.config, { anonymiser: state.anonymiser });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `shortlist-${state.config.client.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Fichier Excel téléchargé.');
  }

  const notes = (r: RankedIdea) =>
    state.config.criteres.map((c) => (
      <span key={c.id}>{c.label} <strong>{finalNote(state.evaluations[r.idea.id], c.id)}</strong></span>
    ));

  return (
    <>
      <div className="no-print">
        <div className="page-head">
          <div>
            <div className="eyebrow">Étape 3 sur 3</div>
            <h2>Shortlist pour le jury</h2>
            <p className="muted lead">Classement par note globale (moyenne des 4 critères). À égalité : impact, puis alignement.</p>
          </div>
          <span className="spacer" />
          <label className="row small">
            Nombre d'idées
            <input className="input" type="number" min={1} max={30} style={{ width: 70 }} value={state.config.tailleShortlist} onChange={(e) => dispatch({ type: 'tailleShortlist', taille: Number(e.target.value) || 1 })} />
          </label>
        </div>

        {(sl.nonNotees.length > 0 || doublonsEnAttente > 0 || nonValidees > 0) && (
          <div className="banner banner-warn">
            <span className="banner-icon"><Icon name="alert" size={16} /></span>
            <div>
              <strong>Shortlist provisoire.</strong>
              <ul className="small">
                {sl.nonNotees.length > 0 && (
                  <li>{sl.nonNotees.length} idée{sl.nonNotees.length > 1 ? 's' : ''} sans note n'apparai{sl.nonNotees.length > 1 ? 'ssent' : 't'} pas encore. <button className="link" onClick={() => goTo('idees')}>Les noter</button></li>
                )}
                {doublonsEnAttente > 0 && (
                  <li>{doublonsEnAttente} doublon{doublonsEnAttente > 1 ? 's' : ''} possible{doublonsEnAttente > 1 ? 's' : ''} à examiner. <button className="link" onClick={() => goTo('doublons')}>Les examiner</button></li>
                )}
                {nonValidees > 0 && <li>{nonValidees} idée{nonValidees > 1 ? 's' : ''} retenue{nonValidees > 1 ? 's' : ''} n'{nonValidees > 1 ? 'ont' : 'a'} pas été relue{nonValidees > 1 ? 's' : ''} : la note est celle proposée par l'IA.</li>}
              </ul>
            </div>
          </div>
        )}

        <div className="layout-2">
          <div className="card">
            {sl.retenues.length === 0 ? (
              <Empty icon="trophy" title="La shortlist apparaîtra ici">
                Commencez par proposer les notes dans l'onglet <button className="link" onClick={() => goTo('idees')}>Idées</button>.
              </Empty>
            ) : (
              sl.retenues.map((r, i) => (
                <div className="sl-item" key={r.idea.id}>
                  <div className={`rank ${i < 3 ? 'rank-top' : ''}`}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap">
                      <span className="idea-title">{r.idea.titre}</span>
                      {r.forcee && <span className="badge badge-ok">Retenue d'office</span>}
                      {!state.evaluations[r.idea.id]?.validee && <span className="badge badge-ai">Non relue</span>}
                    </div>
                    <div className="tiny">{r.idea.id} · {r.idea.direction} · {r.idea.theme} · {formatEuros(r.idea.budgetEur)}</div>
                    <div className="mini-notes">{notes(r)}</div>
                  </div>
                  <Score value={r.total} />
                  <button
                    className="icon-btn"
                    title="Retirer de la shortlist"
                    aria-label={`Retirer ${r.idea.titre}`}
                    onClick={() => {
                      dispatch({ type: 'forcer', ideaId: r.idea.id, valeur: r.forcee ? null : 'out' });
                      toast(`« ${r.idea.titre} » retirée.`, { label: 'Annuler', run: () => dispatch({ type: 'forcer', ideaId: r.idea.id, valeur: r.forcee ? 'in' : null }) });
                    }}
                  >
                    <Icon name="minus" size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="stack">
            <div className="card card-pad stack">
              <h3>Envoyer au client</h3>
              <p className="tiny" style={{ marginTop: -6 }}>Un document propre, avec les notes et vos commentaires.</p>
              <label className="row small" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={state.anonymiser} onChange={(e) => dispatch({ type: 'anonymiser', valeur: e.target.checked })} />
                <span>Masquer le nom des auteurs<br /><span className="tiny">Pour un jury à l'aveugle ou une diffusion large.</span></span>
              </label>
              <button className="btn btn-primary btn-block" disabled={!sl.retenues.length} onClick={() => window.print()}><Icon name="printer" size={16} /> Imprimer ou enregistrer en PDF</button>
              <button className="btn btn-block" disabled={!sl.retenues.length} onClick={download}><Icon name="download" size={16} /> Télécharger pour Excel</button>
            </div>

            {sl.reserve.length > 0 && (
              <div className="card card-pad">
                <h3 style={{ marginBottom: 4 }}>Juste après</h3>
                <p className="tiny" style={{ marginBottom: 8 }}>Pour arbitrer : ajoutez une idée d'office si le jury doit la voir.</p>
                {sl.reserve.map((r) => (
                  <div key={r.idea.id} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small">{r.idea.titre}</div>
                      <div className="tiny">{r.idea.id}</div>
                    </div>
                    <Score value={r.total} />
                    <button className="btn btn-sm" onClick={() => { dispatch({ type: 'forcer', ideaId: r.idea.id, valeur: 'in' }); toast(`« ${r.idea.titre} » ajoutée à la shortlist.`); }}><Icon name="plus" size={14} /> Ajouter</button>
                  </div>
                ))}
              </div>
            )}

            {ecartees.length > 0 && (
              <div className="card card-pad">
                <h3 style={{ marginBottom: 8 }}>Retirées par vous</h3>
                {ecartees.map((i) => (
                  <div key={i.id} className="row small" style={{ padding: '4px 0' }}>
                    <span style={{ flex: 1 }}>{i.titre}</span>
                    <button className="link small" onClick={() => dispatch({ type: 'forcer', ideaId: i.id, valeur: null })}>Remettre</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version imprimable, destinée au client */}
      <div className="print-only doc">
        <h1>{state.config.nom} — idées présentées au jury</h1>
        <p className="doc-sub">
          {sl.retenues.length} idées retenues sur {state.ideas.length} déposées · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          <br />Notes sur 5 : {state.config.criteres.map((c) => c.label.toLowerCase()).join(', ')}. Note globale = moyenne des quatre critères.
        </p>
        {sl.retenues.map((r, i) => {
          const ev = state.evaluations[r.idea.id];
          return (
            <div className="doc-idea" key={r.idea.id}>
              <h3>{i + 1}. {r.idea.titre} — {r.total.toFixed(1).replace('.', ',')}/5</h3>
              <div className="tiny">
                {r.idea.id} · {r.idea.direction}{r.idea.site ? `, ${r.idea.site}` : ''} · {r.idea.theme}
                {!state.anonymiser && ` · Proposée par ${r.idea.prenom} ${r.idea.nom}`}
              </div>
              <div className="doc-notes">{notes(r)}</div>
              <p>{r.idea.description}</p>
              {r.idea.benefices && <p><span className="doc-label">Bénéfices attendus : </span>{r.idea.benefices}</p>}
              <p><span className="doc-label">Budget estimé : </span>{r.idea.budgetEur !== null ? formatEuros(r.idea.budgetEur) : r.idea.budgetBrut || 'non renseigné'}</p>
              {ev?.commentaire && <p><span className="doc-label">Avis INSKIP : </span>{ev.commentaire}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
