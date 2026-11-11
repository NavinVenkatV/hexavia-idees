import { describe, expect, it } from 'vitest';
import { findDuplicates, groupDuplicates, stem, tokenize } from './duplicates';
import { makeIdea } from './testUtils';

const ideas = [
  makeIdea('A', 'Capteurs de vibration sur les presses', 'Installer des capteurs connectés sur les presses pour détecter les pannes avant qu\'elles arrivent : maintenance prédictive.'),
  makeIdea('B', 'Maintenance prédictive des presses', 'Mettre des capteurs connectés sur les presses afin de prévoir les pannes.'),
  makeIdea('C', 'Covoiturage entre collègues', 'Une application interne pour organiser le covoiturage entre salariés du même site.'),
  makeIdea('D', 'Application de covoiturage', 'Créer une appli pour que les collègues fassent du covoiturage domicile-travail.'),
  makeIdea('E', 'Jumeau numérique de la ligne 2', 'Simuler les changements de cadence avant de les appliquer.'),
  makeIdea('F', 'Tri des déchets à la cantine', 'Installer des poubelles de tri et sensibiliser au gaspillage alimentaire.'),
];

describe('tokenize', () => {
  it('retire accents, mots vides et pluriels', () => {
    expect(tokenize('Les Capteurs connectés')).toEqual(tokenize('capteur connecté'));
    expect(tokenize('les de pour avec')).toEqual([]);
    expect(stem('presses')).toBe(stem('presse'));
  });
});

describe('findDuplicates', () => {
  const pairs = findDuplicates(ideas);
  const keys = pairs.map((p) => `${p.a}-${p.b}`);

  it('rapproche deux idées formulées différemment', () => {
    expect(keys).toContain('A-B');
    expect(keys).toContain('C-D');
  });

  it("ne rapproche pas des idées sans rapport", () => {
    expect(keys).not.toContain('A-C');
    expect(keys.some((k) => k.includes('E') || k.includes('F'))).toBe(false);
  });

  it('explique le rapprochement par les mots communs', () => {
    const ab = pairs.find((p) => p.a === 'A' && p.b === 'B')!;
    expect(ab.motsCommuns).toEqual(expect.arrayContaining(['presses', 'capteurs']));
    expect(ab.motsCommuns).toContain('prédictive');
    expect(ab.score).toBeGreaterThan(0.3);
    expect(ab.score).toBeLessThanOrEqual(1);
  });

  it('trie les paires de la plus à la moins probable', () => {
    for (let i = 1; i < pairs.length; i++) expect(pairs[i - 1].score).toBeGreaterThanOrEqual(pairs[i].score);
  });

  it('donne 1 pour deux idées identiques', () => {
    const [p] = findDuplicates([ideas[0], { ...ideas[0], id: 'A2' }]);
    expect(p.score).toBeCloseTo(1, 2);
  });

  it('ne plante pas sans idées ou avec des textes vides', () => {
    expect(findDuplicates([])).toEqual([]);
    expect(findDuplicates([makeIdea('X', '', ''), makeIdea('Y', '', '')])).toEqual([]);
  });
});

describe('groupDuplicates', () => {
  it('regroupe les paires transitives', () => {
    const g = groupDuplicates([
      { a: 'A', b: 'B', score: 1, motsCommuns: [] },
      { a: 'B', b: 'C', score: 1, motsCommuns: [] },
      { a: 'X', b: 'Y', score: 1, motsCommuns: [] },
    ]);
    expect(g).toEqual(expect.arrayContaining([['A', 'B', 'C'], ['X', 'Y']]));
  });
});
