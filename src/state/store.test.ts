import { describe, expect, it } from 'vitest';
import { makeIdea } from '../domain/testUtils';
import { simulateProposal } from '../domain/scoring';
import { initialState, reducer } from './store';

const ideas = [makeIdea('A', 'Capteurs presses', 'Capteurs sur les presses'), makeIdea('B', 'Capteurs presses', 'Capteurs sur les presses')];
const imported = reducer(initialState, { type: 'import', fichier: 'f.csv', ideas, warnings: [] });

describe('état de l\'application', () => {
  it('à l\'import, calcule les doublons possibles', () => {
    expect(imported.paires).toHaveLength(1);
  });

  it('une nouvelle proposition de l\'IA n\'écrase jamais une note de Camille', () => {
    let s = reducer(imported, { type: 'note', ideaId: 'A', critere: 'impact', note: 5 });
    s = reducer(s, { type: 'proposal', ideaId: 'A', proposal: simulateProposal(ideas[0], s.config) });
    expect(s.evaluations.A.manuelles.impact).toBe(5);
    expect(s.evaluations.A.ai).toBeDefined();
  });

  it('effacer une note revient à la proposition', () => {
    let s = reducer(imported, { type: 'note', ideaId: 'A', critere: 'impact', note: 5 });
    s = reducer(s, { type: 'note', ideaId: 'A', critere: 'impact', note: undefined });
    expect('impact' in s.evaluations.A.manuelles).toBe(false);
  });

  it('marquer un doublon puis annuler remet l\'idée en jeu', () => {
    let s = reducer(imported, { type: 'doublon', garder: 'A', ecarter: 'B' });
    expect(s.doublonDe).toEqual({ B: 'A' });
    s = reducer(s, { type: 'annulerDecision', a: 'A', b: 'B' });
    expect(s.doublonDe).toEqual({});
    expect(s.decisions).toEqual({});
  });

  it('un nouvel import repart de zéro', () => {
    const s = reducer(reducer(imported, { type: 'valider', ideaId: 'A', validee: true }), { type: 'import', fichier: 'g.csv', ideas, warnings: [] });
    expect(s.evaluations).toEqual({});
    expect(s.fichier?.nom).toBe('g.csv');
  });
});
