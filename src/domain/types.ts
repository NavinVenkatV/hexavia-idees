/** Une idée telle qu'importée et nettoyée depuis l'export du formulaire. */
export interface Idea {
  id: string;
  /** Date ISO (AAAA-MM-JJ) ou null si illisible. */
  dateDepot: string | null;
  dateBrute: string;
  prenom: string;
  nom: string;
  direction: string;
  site: string;
  theme: string;
  titre: string;
  description: string;
  benefices: string;
  budgetBrut: string;
  /** Budget en euros (milieu de fourchette le cas échéant), null si non chiffrable. */
  budgetEur: number | null;
}

export type CriterionId = 'impact' | 'faisabilite' | 'alignement' | 'innovation';

export interface Criterion {
  id: CriterionId;
  label: string;
  question: string;
  poids: number;
}

/** Proposition de l'IA (simulée ou réelle) pour une idée. */
export interface AiProposal {
  notes: Record<CriterionId, number>;
  justifications: Record<CriterionId, string>;
  source: 'simulation' | 'claude';
  generatedAt: string;
}

export interface Evaluation {
  ideaId: string;
  ai?: AiProposal;
  /** Notes saisies par Camille ; null = on garde la proposition de l'IA. */
  manuelles: Partial<Record<CriterionId, number>>;
  commentaire: string;
  validee: boolean;
}

export interface ImportWarning {
  ligne?: number;
  message: string;
}

export interface ImportResult {
  ideas: Idea[];
  warnings: ImportWarning[];
}

export interface ChallengeConfig {
  nom: string;
  client: string;
  criteres: Criterion[];
  /** Axes stratégiques du client, utilisés pour le critère « alignement ». */
  axesStrategiques: string[];
  tailleShortlist: number;
}
