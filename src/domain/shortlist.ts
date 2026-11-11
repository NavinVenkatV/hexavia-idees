import type { ChallengeConfig, Evaluation, Idea } from './types';
import { finalNote, totalScore } from './scoring';

export interface ShortlistState {
  /** id → id de l'idée qu'elle double (exclue de la shortlist). */
  doublonDe: Record<string, string>;
  /** Choix manuels de Camille : 'in' = toujours retenue, 'out' = jamais. */
  forcees: Record<string, 'in' | 'out'>;
}

export interface RankedIdea {
  idea: Idea;
  total: number;
  rang: number;
  forcee: boolean;
}

export interface Shortlist {
  retenues: RankedIdea[];
  /** Les suivantes au classement, pour arbitrer. */
  reserve: RankedIdea[];
  /** Idées pas encore notées : la shortlist n'est pas définitive tant qu'il en reste. */
  nonNotees: Idea[];
}

/**
 * Classement par note globale ; à égalité, impact puis alignement, puis ordre de dépôt.
 * Les doublons et les idées écartées n'entrent pas ; les idées forcées passent devant.
 */
export function computeShortlist(
  ideas: Idea[],
  evaluations: Record<string, Evaluation>,
  state: ShortlistState,
  config: ChallengeConfig,
): Shortlist {
  const nonNotees: Idea[] = [];
  const candidates: { idea: Idea; total: number }[] = [];
  for (const idea of ideas) {
    if (state.doublonDe[idea.id] || state.forcees[idea.id] === 'out') continue;
    const total = totalScore(evaluations[idea.id], config);
    if (total === null) nonNotees.push(idea);
    else candidates.push({ idea, total });
  }
  const tie = (x: Idea, c: 'impact' | 'alignement') => finalNote(evaluations[x.id], c) ?? 0;
  candidates.sort(
    (a, b) =>
      b.total - a.total ||
      tie(b.idea, 'impact') - tie(a.idea, 'impact') ||
      tie(b.idea, 'alignement') - tie(a.idea, 'alignement') ||
      a.idea.id.localeCompare(b.idea.id),
  );
  const ranked = candidates.map((c, i) => ({ ...c, rang: i + 1, forcee: state.forcees[c.idea.id] === 'in' }));
  const forced = ranked.filter((r) => r.forcee);
  const others = ranked.filter((r) => !r.forcee);
  const places = Math.max(0, config.tailleShortlist - forced.length);
  const retenues = [...forced, ...others.slice(0, places)].sort((a, b) => a.rang - b.rang);
  return { retenues, reserve: others.slice(places, places + 3), nonNotees };
}
