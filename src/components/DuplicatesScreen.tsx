import { useState } from 'react';
import { pairKey, type DuplicatePair } from '../domain/duplicates';
import type { Idea } from '../domain/types';
import type { AppState, Action } from '../state/store';
import { Empty, Highlight } from './ui';

function proximite(score: number): { label: string; cls: string } {
  if (score >= 0.6) return { label: 'Très proches', cls: 'badge-warn' };
  if (score >= 0.4) return { label: 'Proches', cls: 'badge-ai' };
  return { label: 'À vérifier', cls: 'badge-todo' };
}

export function DuplicatesScreen({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const [showDone, setShowDone] = useState(false);
  const byId = new Map(state.ideas.map((i) => [i.id, i]));
  const pending = state.paires.filter((p) => !state.decisions[pairKey(p.a, p.b)]);
  const done = state.paires.filter((p) => state.decisions[pairKey(p.a, p.b)]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Doublons possibles</h2>
          <p className="muted lead">
            Idées dont le titre et la description se ressemblent. Vous décidez : l'idée écartée sort de la shortlist mais reste visible.
          </p>
        </div>
      </div>

      {state.paires.length === 0 ? (
        <div className="card">
          <Empty icon="✓" title="Aucun doublon repéré">Aucune paire d'idées ne se ressemble assez pour être signalée.</Empty>
        </div>
      ) : pending.length === 0 ? (
        <div className="banner banner-ok"><span aria-hidden>✓</span><span>Toutes les paires signalées ont été examinées.</span></div>
      ) : (
        <p className="small muted" style={{ marginBottom: 12 }}>{pending.length} paire{pending.length > 1 ? 's' : ''} à examiner, de la plus probable à la moins probable.</p>
      )}

      <div className="stack">
        {pending.map((p) => {
          const a = byId.get(p.a);
          const b = byId.get(p.b);
          return a && b ? <PairCard key={pairKey(p.a, p.b)} pair={p} a={a} b={b} dispatch={dispatch} state={state} /> : null;
        })}
      </div>

      {done.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button className="link" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Masquer' : 'Afficher'} les {done.length} paire{done.length > 1 ? 's' : ''} déjà examinée{done.length > 1 ? 's' : ''}
          </button>
          {showDone && (
            <div className="card" style={{ marginTop: 10 }}>
              {done.map((p) => {
                const decision = state.decisions[pairKey(p.a, p.b)];
                const ecartee = state.doublonDe[p.a] === p.b ? p.a : state.doublonDe[p.b] === p.a ? p.b : null;
                return (
                  <div key={pairKey(p.a, p.b)} className="sl-item">
                    <div style={{ flex: 1 }}>
                      <div className="small"><strong>{p.a}</strong> {byId.get(p.a)?.titre} · <strong>{p.b}</strong> {byId.get(p.b)?.titre}</div>
                      <div className="tiny">{decision === 'distinct' ? 'Idées différentes : les deux restent en lice.' : `Doublon : ${ecartee} écartée.`}</div>
                    </div>
                    <button className="btn btn-sm" onClick={() => dispatch({ type: 'annulerDecision', a: p.a, b: p.b })}>Annuler</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function PairCard({ pair, a, b, state, dispatch }: { pair: DuplicatePair; a: Idea; b: Idea; state: AppState; dispatch: (x: Action) => void }) {
  const prox = proximite(pair.score);
  const side = (i: Idea) => (
    <div className="pair-side">
      <div className="row wrap" style={{ marginBottom: 4 }}>
        <span className="id">{i.id}</span>
        {state.doublonDe[i.id] && <span className="badge badge-muted">déjà écartée</span>}
      </div>
      <h3 style={{ marginBottom: 6 }}><Highlight text={i.titre} words={pair.motsCommuns} /></h3>
      <p className="small clamp"><Highlight text={i.description} words={pair.motsCommuns} /></p>
      <p className="tiny" style={{ marginTop: 8 }}>{`${i.prenom} ${i.nom}`.trim()} · {i.direction}{i.site ? `, ${i.site}` : ''} · {i.dateDepot ? new Date(i.dateDepot).toLocaleDateString('fr-FR') : ''}</p>
    </div>
  );
  return (
    <div className="card pair">
      <div className="pair-head">
        <span className={`badge ${prox.cls}`}>{prox.label}</span>
        <span className="small muted">Mots en commun : {pair.motsCommuns.join(', ')}</span>
      </div>
      {side(a)}
      {side(b)}
      <div className="pair-actions">
        <button className="btn btn-sm" onClick={() => dispatch({ type: 'doublon', garder: a.id, ecarter: b.id })}>Doublon : garder {a.id}</button>
        <button className="btn btn-sm" onClick={() => dispatch({ type: 'doublon', garder: b.id, ecarter: a.id })}>Doublon : garder {b.id}</button>
        <span className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: 'distinct', a: a.id, b: b.id })}>Ce sont deux idées différentes</button>
      </div>
    </div>
  );
}
