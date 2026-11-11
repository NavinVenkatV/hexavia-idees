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

const STEPS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'idees', label: 'Idées', icon: 'list' },
  { id: 'doublons', label: 'Doublons', icon: 'copy' },
  { id: 'shortlist', label: 'Shortlist', icon: 'trophy' },
];

export function Navbar({ state, tab, setTab, counts, onNewFile }: Props) {
  const hasData = state.ideas.length > 0;
  const pct = hasData ? Math.round((counts.validees / state.ideas.length) * 100) : 0;

  const badge = (id: Tab) => {
    if (id === 'idees') return <span className="nav-count">{counts.validees}/{state.ideas.length}</span>;
    if (id === 'doublons') return counts.doublons > 0 ? <span className="nav-count alert">{counts.doublons}</span> : <span className="nav-count ok"><Icon name="check" size={11} /></span>;
    return <span className="nav-count">{counts.retenues}</span>;
  };

  return (
    <header className="navbar no-print">
      <div className="navbar-inner">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); setTab('idees'); }} aria-label="Pépite, accueil">
          <span className="brand-mark" aria-hidden><Icon name="star" size={16} /></span>
          <span className="brand-name">Pépite</span>
        </a>

        <div className="nav-context hide-md">
          <span className="nav-divider" aria-hidden />
          <div>
            <div className="nav-client">Challenge {state.config.client}</div>
            <div className="nav-file">
              {state.fichier ? <><Icon name="file" size={12} /> {state.fichier.nom} · {pct} % validées</> : 'Aucun fichier importé'}
            </div>
          </div>
        </div>

        {hasData && (
          <nav className="nav" aria-label="Étapes">
            {STEPS.map((s, i) => (
              <button key={s.id} className="nav-link" aria-current={tab === s.id ? 'page' : undefined} onClick={() => setTab(s.id)}>
                <Icon name={s.icon} size={16} />
                <span className="nav-label">{i + 1}. {s.label}</span>
                {badge(s.id)}
              </button>
            ))}
          </nav>
        )}

        <div className="nav-actions">
          <span
            className={`ai-chip ${AI_MODE} hide-sm`}
            title={AI_MODE === 'simulation' ? 'Notes proposées calculées dans le navigateur, sans modèle externe. Aucune donnée envoyée.' : 'Notes proposées par Claude (Anthropic).'}
          >
            <Icon name="sparkles" size={14} />
            {AI_MODE === 'simulation' ? 'IA simulée' : 'IA : Claude'}
          </span>
          {hasData && (
            <button className="btn btn-sm" onClick={onNewFile} title="Importer un autre fichier">
              <Icon name="upload" size={15} /> <span className="hide-sm">Nouveau fichier</span>
            </button>
          )}
        </div>
      </div>
      {hasData && (
        <div className="nav-progress" aria-hidden>
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="app-footer no-print">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark small" aria-hidden><Icon name="star" size={12} /></span>
          <span><strong>Pépite</strong> · le tri des idées pour les challenges d'innovation</span>
        </div>
        <span className="spacer" />
        <span className="footer-note"><Icon name="lock" size={12} /> Données conservées sur cet ordinateur</span>
        <span className="footer-sep" aria-hidden>·</span>
        <span>Conçu par <strong>Navin Venkat Venkatesan</strong> pour INSKIP</span>
        <span className="footer-sep" aria-hidden>·</span>
        <a href="https://github.com/NavinVenkatV/hexavia-idees" target="_blank" rel="noreferrer">Code source</a>
      </div>
    </footer>
  );
}
