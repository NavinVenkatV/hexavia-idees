import type { ReactNode } from 'react';
import type { Evaluation } from '../domain/types';

export function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="score score-lo" title="Pas encore notée">–</span>;
  const cls = value >= 3.75 ? 'score-hi' : value >= 2.75 ? 'score-mid' : 'score-lo';
  return <span className={`score ${cls}`}>{value.toFixed(1).replace('.', ',')}</span>;
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

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>{icon}</div>
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
