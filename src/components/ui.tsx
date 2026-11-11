import type { ReactNode } from 'react';
import type { Evaluation } from '../domain/types';
import { Icon, type IconName } from './Icon';

export function Score({ value, large }: { value: number | null; large?: boolean }) {
  const size = large ? ' score-lg' : '';
  if (value === null) return <span className={`score score-none${size}`} title="Pas encore notée">–</span>;
  const cls = value >= 3.75 ? 'score-hi' : value >= 2.75 ? 'score-mid' : 'score-lo';
  return <span className={`score ${cls}${size}`}>{value.toFixed(1).replace('.', ',')}</span>;
}

/** Quatre petites barres : le profil de l'idée sur la grille, lisible d'un coup d'œil. */
export function CriteriaBars({ notes, labels }: { notes: (number | null)[]; labels: string[] }) {
  return (
    <span className="bars" aria-label={labels.map((l, i) => `${l} ${notes[i] ?? '–'}/5`).join(', ')}>
      {notes.map((n, i) => (
        <span key={i} className="bar" title={`${labels[i]} : ${n ?? '–'}/5`}>
          <span style={{ height: `${((n ?? 0) / 5) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}

export type Statut = 'a_noter' | 'proposee' | 'validee';

export function statutOf(ev: Evaluation | undefined): Statut {
  if (ev?.validee) return 'validee';
  if (ev?.ai || Object.keys(ev?.manuelles ?? {}).length) return 'proposee';
  return 'a_noter';
}

export const STATUT_LABEL: Record<Statut, string> = {
  a_noter: 'À noter',
  proposee: 'À relire',
  validee: 'Validée',
};

export function StatutBadge({ statut }: { statut: Statut }) {
  const cls = statut === 'validee' ? 'badge-ok' : statut === 'proposee' ? 'badge-ai' : 'badge-todo';
  return <span className={`badge ${cls}`}>{statut === 'validee' ? '✓ ' : ''}{STATUT_LABEL[statut]}</span>;
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      {children && <div className="muted" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

/** Met en évidence des mots (déjà sans accents) dans un texte. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const roots = words.map((w) => strip(w).slice(0, Math.max(4, w.length - 2)));
  const parts = text.split(/(\p{L}+)/u);
  return (
    <>
      {parts.map((p, i) => (p.length > 2 && roots.some((r) => strip(p).startsWith(r)) ? <mark key={i}>{p}</mark> : p))}
    </>
  );
}
