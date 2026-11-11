import { AI_MODE } from '../ai/propose';
import type { AppState } from '../state/store';
import { Icon, type IconName } from './Icon';

export type Tab = 'idees' | 'doublons' | 'shortlist';

interface Props {
  state: AppState;
  tab: Tab;
  setTab: (t: Tab) => void;
  counts: { validees: number; doublons: number; retenues: number };
  onNewFile: () => void;
}

const STEPS: { id: Tab; label: string; hint: string; icon: IconName }[] = [
  { id: 'idees', label: 'Idées', hint: 'Relire et noter', icon: 'list' },
  { id: 'doublons', label: 'Doublons', hint: 'Écarter les répétitions', icon: 'copy' },
  { id: 'shortlist', label: 'Shortlist', hint: 'Préparer le jury', icon: 'trophy' },
];

export function Sidebar({ state, tab, setTab, counts, onNewFile }: Props) {
  const hasData = state.ideas.length > 0;
  const pct = hasData ? Math.round((counts.validees / state.ideas.length) * 100) : 0;

  const badge = (id: Tab) => {
    if (id === 'idees') return <span className="nav-count">{counts.validees}/{state.ideas.length}</span>;
    if (id === 'doublons') return counts.doublons > 0 ? <span className="nav-count alert">{counts.doublons}</span> : <span className="nav-count ok"><Icon name="check" size={12} /></span>;
    return <span className="nav-count">{counts.retenues}</span>;
  };

  return (
    <aside className="sidebar no-print">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <Icon name="star" size={16} />
        </div>
        <div>
          <div className="brand-name">Pépite</div>
          <div className="brand-sub">Tri des idées</div>
        </div>
      </div>

      <div className="challenge-card">
        <div className="eyebrow">Challenge en cours</div>
        <div className="challenge-name">{state.config.client}</div>
        {state.fichier ? (
          <>
            <div className="challenge-file" title={state.fichier.nom}>
              <Icon name="file" size={13} /> {state.fichier.nom}
            </div>
            <div className="mini-progress" aria-label={`${pct} % des idées validées`}>
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="tiny">{pct} % validées</div>
          </>
        ) : (
          <div className="tiny">Aucun fichier importé</div>
        )}
      </div>

      {hasData && (
        <nav className="nav" aria-label="Étapes">
          <div className="eyebrow nav-title">Étapes</div>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className="nav-item"
              aria-current={tab === s.id ? 'page' : undefined}
              onClick={() => setTab(s.id)}
            >
              <span className="nav-icon"><Icon name={s.icon} size={17} /></span>
              <span className="nav-text">
                <span className="nav-label">{i + 1}. {s.label}</span>
                <span className="nav-hint">{s.hint}</span>
              </span>
              {badge(s.id)}
            </button>
          ))}
        </nav>
      )}

      <div className="sidebar-foot">
        <div className={`ai-chip ${AI_MODE}`} title={AI_MODE === 'simulation' ? 'Notes proposées calculées dans le navigateur, sans modèle externe.' : 'Notes proposées par Claude (Anthropic).'}>
          <Icon name="sparkles" size={14} />
          {AI_MODE === 'simulation' ? 'IA : mode simulation' : 'IA : Claude'}
        </div>
        <div className="privacy">
          <Icon name="lock" size={13} /> Données conservées sur cet ordinateur
        </div>
        {hasData && (
          <button className="btn btn-quiet btn-block" onClick={onNewFile}>
            <Icon name="upload" size={15} /> Importer un autre fichier
          </button>
        )}
      </div>
    </aside>
  );
}

export function Footer() {
  return (
    <footer className="app-footer no-print">
      <span>
        <strong>Pépite</strong> · outil de tri des idées pour les challenges d'innovation
      </span>
      <span className="footer-sep" aria-hidden>·</span>
      <span>
        Conçu par <strong>Navin Venkat Venkatesan</strong> pour INSKIP
      </span>
      <span className="spacer" />
      <a href="https://github.com/NavinVenkatV/hexavia-idees" target="_blank" rel="noreferrer">Code source</a>
    </footer>
  );
}
