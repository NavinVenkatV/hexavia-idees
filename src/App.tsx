import { useEffect, useState } from 'react';
import { pairKey } from './domain/duplicates';
import { computeShortlist } from './domain/shortlist';
import { DuplicatesScreen } from './components/DuplicatesScreen';
import { Icon } from './components/Icon';
import { IdeasScreen } from './components/IdeasScreen';
import { ImportScreen } from './components/ImportScreen';
import { ShortlistScreen } from './components/ShortlistScreen';
import { Footer, Sidebar, type Tab } from './components/Sidebar';
import { useAppState } from './state/store';

export default function App() {
  const [state, dispatch] = useAppState();
  const [tab, setTab] = useState<Tab>('idees');
  const [confirmReset, setConfirmReset] = useState(false);
  const hasData = state.ideas.length > 0;

  const counts = {
    validees: state.ideas.filter((i) => state.evaluations[i.id]?.validee).length,
    doublons: state.paires.filter((p) => !state.decisions[pairKey(p.a, p.b)]).length,
    retenues: hasData ? computeShortlist(state.ideas, state.evaluations, state, state.config).retenues.length : 0,
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="shell">
      <Sidebar state={state} tab={tab} setTab={setTab} counts={counts} onNewFile={() => setConfirmReset(true)} />

      <div className="main-col">
        <main key={hasData ? tab : 'import'} className="page">
          {!hasData && <ImportScreen dispatch={dispatch} clientName={state.config.client} />}
          {hasData && tab === 'idees' && <IdeasScreen state={state} dispatch={dispatch} goTo={setTab} />}
          {hasData && tab === 'doublons' && <DuplicatesScreen state={state} dispatch={dispatch} />}
          {hasData && tab === 'shortlist' && <ShortlistScreen state={state} dispatch={dispatch} goTo={setTab} />}
        </main>
        <Footer />
      </div>

      {confirmReset && (
        <>
          <div className="modal-backdrop" onClick={() => setConfirmReset(false)} />
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="modal-icon"><Icon name="alert" size={20} /></div>
            <h3 id="reset-title">Importer un autre fichier ?</h3>
            <p className="muted">Les notes, commentaires et décisions actuels seront effacés de cet ordinateur. Pensez à exporter la shortlist avant.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmReset(false)} autoFocus>Annuler</button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  dispatch({ type: 'reset' });
                  setTab('idees');
                  setConfirmReset(false);
                }}
              >
                Effacer et importer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
