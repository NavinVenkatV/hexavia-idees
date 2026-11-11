import { useEffect, useReducer } from 'react';
import { CONFIG_HEXAVIA } from '../domain/config';
import { findDuplicates, pairKey, type DuplicatePair } from '../domain/duplicates';
import type { AiProposal, ChallengeConfig, CriterionId, Evaluation, Idea, ImportWarning } from '../domain/types';

export interface AppState {
  version: 1;
  config: ChallengeConfig;
  fichier: { nom: string; importeLe: string } | null;
  ideas: Idea[];
  warnings: ImportWarning[];
  evaluations: Record<string, Evaluation>;
  paires: DuplicatePair[];
  /** Paires que Camille a tranchées (doublon ou non) : clé de paire → décision. */
  decisions: Record<string, 'doublon' | 'distinct'>;
  doublonDe: Record<string, string>;
  forcees: Record<string, 'in' | 'out'>;
  anonymiser: boolean;
}

export type Action =
  | { type: 'import'; fichier: string; ideas: Idea[]; warnings: ImportWarning[] }
  | { type: 'reset' }
  | { type: 'proposal'; ideaId: string; proposal: AiProposal }
  | { type: 'note'; ideaId: string; critere: CriterionId; note: number | undefined }
  | { type: 'commentaire'; ideaId: string; texte: string }
  | { type: 'valider'; ideaId: string; validee: boolean }
  | { type: 'doublon'; garder: string; ecarter: string }
  | { type: 'distinct'; a: string; b: string }
  | { type: 'annulerDecision'; a: string; b: string }
  | { type: 'forcer'; ideaId: string; valeur: 'in' | 'out' | null }
  | { type: 'tailleShortlist'; taille: number }
  | { type: 'anonymiser'; valeur: boolean };

const STORAGE_KEY = 'tri-idees:v1';

export const initialState: AppState = {
  version: 1, config: CONFIG_HEXAVIA, fichier: null, ideas: [], warnings: [], evaluations: {},
  paires: [], decisions: {}, doublonDe: {}, forcees: {}, anonymiser: false,
};

const emptyEval = (ideaId: string): Evaluation => ({ ideaId, manuelles: {}, commentaire: '', validee: false });

function updateEval(state: AppState, ideaId: string, f: (e: Evaluation) => Evaluation): AppState {
  return { ...state, evaluations: { ...state.evaluations, [ideaId]: f(state.evaluations[ideaId] ?? emptyEval(ideaId)) } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'import':
      return {
        ...initialState,
        config: state.config,
        fichier: { nom: action.fichier, importeLe: new Date().toISOString() },
        ideas: action.ideas,
        warnings: action.warnings,
        paires: findDuplicates(action.ideas),
      };
    case 'reset':
      return { ...initialState, config: state.config };
    case 'proposal':
      return updateEval(state, action.ideaId, (e) => ({ ...e, ai: action.proposal }));
    case 'note':
      return updateEval(state, action.ideaId, (e) => {
        const manuelles = { ...e.manuelles };
        if (action.note === undefined) delete manuelles[action.critere];
        else manuelles[action.critere] = action.note;
        return { ...e, manuelles };
      });
    case 'commentaire':
      return updateEval(state, action.ideaId, (e) => ({ ...e, commentaire: action.texte }));
    case 'valider':
      return updateEval(state, action.ideaId, (e) => ({ ...e, validee: action.validee }));
    case 'doublon':
      return {
        ...state,
        decisions: { ...state.decisions, [pairKey(action.garder, action.ecarter)]: 'doublon' },
        doublonDe: { ...state.doublonDe, [action.ecarter]: action.garder },
      };
    case 'distinct':
      return { ...state, decisions: { ...state.decisions, [pairKey(action.a, action.b)]: 'distinct' } };
    case 'annulerDecision': {
      const decisions = { ...state.decisions };
      delete decisions[pairKey(action.a, action.b)];
      const doublonDe = { ...state.doublonDe };
      if (doublonDe[action.a] === action.b) delete doublonDe[action.a];
      if (doublonDe[action.b] === action.a) delete doublonDe[action.b];
      return { ...state, decisions, doublonDe };
    }
    case 'forcer': {
      const forcees = { ...state.forcees };
      if (action.valeur === null) delete forcees[action.ideaId];
      else forcees[action.ideaId] = action.valeur;
      return { ...state, forcees };
    }
    case 'tailleShortlist':
      return { ...state, config: { ...state.config, tailleShortlist: Math.max(1, Math.min(30, action.taille)) } };
    case 'anonymiser':
      return { ...state, anonymiser: action.valeur };
  }
}

/** Lecture prudente : stockage indisponible ou données d'une autre version → on repart de zéro. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    return parsed?.version === 1 && Array.isArray(parsed.ideas) ? { ...initialState, ...parsed } : initialState;
  } catch {
    return initialState;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* stockage plein ou bloqué : l'outil reste utilisable pendant la session */
    }
  }, [state]);
  return [state, dispatch] as const;
}
