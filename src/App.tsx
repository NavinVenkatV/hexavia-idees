import { useState } from 'react';
import { AI_MODE } from './ai/propose';
import { pairKey } from './domain/duplicates';
import { computeShortlist } from './domain/shortlist';
import { DuplicatesScreen } from './components/DuplicatesScreen';
import { IdeasScreen } from './components/IdeasScreen';
import { ImportScreen } from './components/ImportScreen';
import { ShortlistScreen } from './components/ShortlistScreen';
import { useAppState } from './state/store';

type Tab = 'idees' | 'doublons' | 'shortlist';

export default function App() {
  const [state, dispatch] = useAppState();
  const [tab, setTab] = useState<Tab>('idees');
  const hasData = state.ideas.length > 0;

  const doublonsEnAttente = state.paires.filter((p) => !state.decisions[pairKey(p.a, p.b)]).length;
  const retenues = hasData ? computeShortlist(state.ideas, state.evaluations, state, state.config).retenues.length : 0;

  function nouveauFichier() {
    if (window.confirm('Importer un nouveau fichier ? Les notes et décisions actuelles seront effacées de cet ordinateur.')) {
      dispatch({ type: 'reset' });
      setTab('idees');
    }
  }

  return (
    <>
      <header className="app-header no-print">
        <div className="brand">
          <div className="brand-mark" aria-hidden>P</div>
          <div>
            <h1>Pépite</h1>
            <div className="tiny">{state.config.nom}</div>
          </div>
        </div>
        {hasData && (
          <nav className="tabs" role="tablist" aria-label="Étapes">
            <button className="tab" role="tab" aria-selected={tab === 'idees'} onClick={() => setTab('idees')}>
              1. Idées <span className="count">{state.ideas.length}</span>
            </button>
            <button className="tab" role="tab" aria-selected={tab === 'doublons'} onClick={() => setTab('doublons')}>
              2. Doublons {doublonsEnAttente > 0 && <span className="count alert">{doublonsEnAttente}</span>}
            </button>
            <button className="tab" role="tab" aria-selected={tab === 'shortlist'} onClick={() => setTab('shortlist')}>
              3. Shortlist <span className="count">{retenues}</span>
            </button>
          </nav>
        )}
        <span className="spacer" />
        {AI_MODE === 'simulation' && (
          <span className="badge badge-ai hide-sm" title="Les notes proposées sont calculées dans le navigateur, sans modèle d'IA externe. Voir le README pour brancher un vrai modèle.">
            IA : mode simulation
          </span>
        )}
        {hasData && (
          <button className="btn btn-sm" onClick={nouveauFichier}>Nouveau fichier</button>
        )}
      </header>

      <main>
        {!hasData && <ImportScreen dispatch={dispatch} clientName={state.config.client} />}
        {hasData && tab === 'idees' && <IdeasScreen state={state} dispatch={dispatch} />}
        {hasData && tab === 'doublons' && <DuplicatesScreen state={state} dispatch={dispatch} />}
        {hasData && tab === 'shortlist' && <ShortlistScreen state={state} dispatch={dispatch} goTo={setTab} />}
      </main>
    </>
  );
}
