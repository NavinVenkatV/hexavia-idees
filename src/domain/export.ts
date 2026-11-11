import type { ChallengeConfig, Evaluation } from './types';
import type { RankedIdea } from './shortlist';
import { finalNote } from './scoring';
import { formatEuros } from './normalize';

/**
 * Échappe une cellule pour Excel (séparateur « ; »). Neutralise aussi les cellules qui
 * commencent par = + - @ : le texte vient des salariés et le fichier part chez le client,
 * on ne veut pas qu'Excel exécute une formule (injection CSV).
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  s = s.replace(/[  ]/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface ExportOptions {
  /** Masque prénom et nom des auteurs (jury à l'aveugle, ou diffusion large). */
  anonymiser: boolean;
}

export function shortlistToCsv(
  retenues: RankedIdea[],
  evaluations: Record<string, Evaluation>,
  config: ChallengeConfig,
  options: ExportOptions,
): string {
  const header = [
    'Rang', 'Identifiant', 'Titre', 'Thème', 'Direction', 'Site',
    ...(options.anonymiser ? [] : ['Auteur']),
    ...config.criteres.map((c) => `${c.label} (/5)`),
    'Note globale (/5)', 'Budget estimé', 'Description', 'Bénéfices attendus', 'Commentaire',
  ];
  const rows = retenues.map(({ idea, total }, i) => {
    const ev = evaluations[idea.id];
    return [
      i + 1, idea.id, idea.titre, idea.theme, idea.direction, idea.site,
      ...(options.anonymiser ? [] : [`${idea.prenom} ${idea.nom}`.trim()]),
      ...config.criteres.map((c) => finalNote(ev, c.id)),
      total.toFixed(1).replace('.', ','),
      idea.budgetEur === null ? idea.budgetBrut || 'Non renseigné' : formatEuros(idea.budgetEur),
      idea.description, idea.benefices, ev?.commentaire ?? '',
    ];
  });
  // BOM pour qu'Excel lise les accents correctement
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}
