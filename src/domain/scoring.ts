import { z } from 'zod';
import type { AiProposal, ChallengeConfig, CriterionId, Evaluation, Idea } from './types.js';
import { normalizeText } from './normalize.js';

export const CRITERION_IDS: CriterionId[] = ['impact', 'faisabilite', 'alignement', 'innovation'];

const note = z.number().int().min(1).max(5);
const justification = z.string().trim().min(1).max(600);

/** Format attendu de la réponse du modèle (réel ou simulé). Partagé avec api/score.ts. */
export const ModelOutputSchema = z.object({
  notes: z.object({ impact: note, faisabilite: note, alignement: note, innovation: note }),
  justifications: z.object({
    impact: justification, faisabilite: justification, alignement: justification, innovation: justification,
  }),
});
export type ModelOutput = z.infer<typeof ModelOutputSchema>;

/**
 * Valide une réponse de modèle. On ne corrige jamais une note hors grille en silence :
 * une réponse invalide est refusée et l'idée reste « à noter ».
 */
export function parseModelOutput(raw: unknown): { ok: true; value: ModelOutput } | { ok: false; error: string } {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Réponse illisible.' };
    }
  }
  const r = ModelOutputSchema.safeParse(data);
  return r.success ? { ok: true, value: r.data } : { ok: false, error: 'Réponse incomplète ou notes hors de la grille 1 à 5.' };
}

/** Note retenue pour un critère : celle de Camille si elle l'a saisie, sinon la proposition. */
export function finalNote(ev: Evaluation | undefined, c: CriterionId): number | null {
  if (!ev) return null;
  return ev.manuelles[c] ?? ev.ai?.notes[c] ?? null;
}

/** Moyenne pondérée sur 5, arrondie au dixième. null tant qu'un critère n'a pas de note. */
export function totalScore(ev: Evaluation | undefined, config: ChallengeConfig): number | null {
  let sum = 0;
  let poids = 0;
  for (const c of config.criteres) {
    const n = finalNote(ev, c.id);
    if (n === null) return null;
    sum += n * c.poids;
    poids += c.poids;
  }
  return poids === 0 ? null : Math.round((sum / poids) * 10) / 10;
}

export function isModified(ev: Evaluation | undefined, c: CriterionId): boolean {
  return !!ev?.ai && ev.manuelles[c] !== undefined && ev.manuelles[c] !== ev.ai.notes[c];
}

// ---------------------------------------------------------------------------
// Prompt envoyé au modèle réel : jamais de nom ni de prénom (minimisation des données).
// ---------------------------------------------------------------------------

export function buildPrompt(idea: Idea, config: ChallengeConfig): string {
  const grille = config.criteres.map((c) => `- ${c.id} (${c.label}) : ${c.question}`).join('\n');
  const axes = config.axesStrategiques.map((a) => `- ${a.label}`).join('\n');
  return `Tu aides une consultante à pré-évaluer les idées d'un challenge d'innovation interne chez ${config.client}.
Note l'idée ci-dessous de 1 (très faible) à 5 (excellent) sur chaque critère, avec une justification
d'une ou deux phrases qui cite des éléments concrets de l'idée. Sois exigeant et cohérent : une note
de 5 doit rester rare. Si une information manque (budget, bénéfices), dis-le dans la justification.

Grille :
${grille}

Axes stratégiques du client :
${axes}

Idée :
- Thème : ${idea.theme || 'non renseigné'}
- Direction : ${idea.direction || 'non renseignée'}
- Titre : ${idea.titre}
- Description : ${idea.description}
- Bénéfices attendus : ${idea.benefices || 'non renseignés'}
- Budget estimé : ${idea.budgetBrut || 'non renseigné'}

Réponds en français.`;
}

// ---------------------------------------------------------------------------
// Simulation du modèle (aucune clé API) : heuristique déterministe et explicable.
// ---------------------------------------------------------------------------

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
/**
 * Mots-clés cherchés en début de mot (« commande » ne doit pas trouver « recommander »,
 * ni « eau » trouver « nouveaux »). Un mot-clé terminé par une espace doit être un mot entier.
 */
const has = (text: string, words: string[]) =>
  words.filter((w) => (w.endsWith(' ') ? text.includes(` ${w.trim()} `) : text.includes(` ${w}`)));
const words = (s: string) => ` ${normalizeText(s).replace(/[^a-z0-9]+/g, ' ')} `;

/** Mot-clé recherché (sans accents) → libellé affiché dans la justification. */
const ENJEUX: Record<string, string> = {
  cout: 'coûts', economi: 'économies', securite: 'sécurité', accident: 'sécurité', qualite: 'qualité',
  rebut: 'qualité', client: 'clients', co2: 'CO₂', energie: 'énergie', productivite: 'productivité',
  delai: 'délais', panne: 'disponibilité des machines', arret: 'disponibilité des machines', temps: 'temps gagné',
};
const COMPLEXE = ['intelligence artificielle', ' ia ', 'jumeau numerique', 'blockchain', 'robot', 'erp', 'refonte', 'plateforme', 'algorithme', 'cobot'];
const TECHNO = ['capteur', ' ia ', 'intelligence artificielle', 'numerique', 'automatis', 'connecte', 'donnees', 'algorithme', 'impression 3d', 'robot', 'cobot', 'jumeau', 'realite', 'drone'];
const NOUVEAUTE = ['premier', 'jamais', 'inedit', 'innovant', 'brevet', 'experiment', 'tester', 'pilote'];

function extrait(s: string, max = 70): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function simulateProposal(idea: Idea, config: ChallengeConfig, now = new Date()): AiProposal {
  const texte = words(`${idea.titre} ${idea.description} ${idea.benefices}`);
  const benef = normalizeText(idea.benefices);
  const chiffre =
    idea.benefices.match(/[^.;,\n]*\d+\s*(%|€|k€|h\b|heures?|jours?|semaines?|tonnes?|t\b|minutes?|mwh|postes?)[^.;,\n]*/i) ??
    idea.benefices.match(/[^.;,\n]*(divis\p{L}* par|doubl\p{L}*|moitié|poste et demi)[^.;,\n]*/iu);
  const constat = idea.description.match(/[^.;:\n]*\d+\s*(%|minutes?|heures?|jours?|mails?|personnes?|mètres?|tonnes?|fournisseurs?)[^.;:\n]*/i);
  const vague = !!benef && !chiffre && benef.length < 25;

  // Impact
  const enjeux = [...new Set(has(texte, Object.keys(ENJEUX)).map((k) => ENJEUX[k]))];
  let impact = 2 + (chiffre ? 1 : 0) + (constat ? 0.5 : 0) + Math.min(1.5, enjeux.length * 0.75) - (benef ? 0 : 1) - (vague ? 0.5 : 0);
  const jImpact = [
    chiffre
      ? `Bénéfice chiffré : « ${extrait(chiffre[0])} ».`
      : vague
        ? `Bénéfice très général (« ${extrait(idea.benefices, 40)} ») et non chiffré.`
        : benef
          ? 'Bénéfices annoncés mais non chiffrés.'
          : 'Aucun bénéfice renseigné : impact difficile à apprécier.',
    constat ? `Part d'un constat mesuré : « ${extrait(constat[0])} ».` : '',
    enjeux.length ? `Touche à des enjeux clés : ${enjeux.slice(0, 3).join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  // Faisabilité
  const b = idea.budgetEur;
  const complexes = has(texte, COMPLEXE);
  let faisa = b === null ? 3 : b < 10_000 ? 5 : b < 50_000 ? 4 : b < 200_000 ? 3 : b < 1_000_000 ? 2 : 1;
  if (complexes.length) faisa -= 1;
  const jFaisa = [
    b === null ? `Budget non chiffré (« ${idea.budgetBrut || 'vide'} ») : note prudente.` : `Budget estimé autour de ${new Intl.NumberFormat('fr-FR').format(b)} €.`,
    complexes.length ? `Mise en œuvre technique exigeante (${complexes.map((c) => c.trim()).join(', ')}).` : '',
  ].filter(Boolean).join(' ');

  // Alignement
  const axes = config.axesStrategiques.filter((a) => has(texte, a.motsCles).length > 0);
  const align = axes.length === 0 ? 2 : axes.length === 1 ? 3 : axes.length === 2 ? 4 : 5;
  const jAlign = axes.length
    ? `Rejoint ${axes.length > 1 ? 'les axes' : "l'axe"} : ${axes.map((a) => a.label).join(', ')}.`
    : 'Pas de lien explicite avec les axes stratégiques retenus.';

  // Innovation
  const techno = has(texte, TECHNO);
  const nouveau = has(words(`${idea.titre} ${idea.description}`), NOUVEAUTE);
  let innov = 2 + (techno.length ? 1 : 0) + (nouveau.length ? 1 : 0) + (idea.description.length > 250 ? 0.5 : 0) - (idea.description.length < 60 ? 1 : 0);
  const jInnov = [
    techno.length ? `S'appuie sur des technologies récentes (${[...new Set(techno.map((t) => t.trim()))].slice(0, 3).join(', ')}).` : 'Amélioration plutôt incrémentale.',
    idea.description.length < 60 ? 'Description très courte : à approfondir avec l\'auteur.' : '',
  ].filter(Boolean).join(' ');

  impact = clamp(impact);
  innov = clamp(innov);
  return {
    notes: { impact, faisabilite: clamp(faisa), alignement: clamp(align), innovation: innov },
    justifications: { impact: jImpact, faisabilite: jFaisa, alignement: jAlign, innovation: jInnov },
    source: 'simulation',
    generatedAt: now.toISOString(),
  };
}
