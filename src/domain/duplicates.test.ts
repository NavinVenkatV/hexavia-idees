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

describe('cas constatés sur l\'export réel', () => {
  it('rapproche « chatbot » et « assistant conversationnel »', () => {
    const p = findDuplicates([
      makeIdea('A', 'Assistant IA pour les questions RH', "Un assistant conversationnel sur l'intranet qui répond aux questions courantes des salariés : congés, mutuelle."),
      makeIdea('B', 'Chatbot RH', 'Un robot qui répond aux questions des salariés sur la paie et les congés.'),
      ...ideas.slice(4),
    ]);
    expect(p.map((x) => `${x.a}-${x.b}`)).toContain('A-B');
  });

  it('rapproche « dictée des comptes rendus » et « dicter le rapport »', () => {
    const p = findDuplicates([
      makeIdea('A', "Copilote IA pour les rapports d'intervention", "Les techniciens dictent leurs constats sur smartphone et une IA rédige le rapport d'intervention."),
      makeIdea('B', 'Dictée vocale des comptes rendus', "Pouvoir dicter son compte rendu d'intervention au lieu de le taper sur la tablette."),
      ...ideas.slice(4),
    ]);
    expect(p.map((x) => `${x.a}-${x.b}`)).toContain('A-B');
  });

  it("marque comme identique une idée déposée deux fois", () => {
    const [p] = findDuplicates([ideas[0], { ...ideas[0], id: 'A2' }]);
    expect(p.identique).toBe(true);
    expect(findDuplicates(ideas).every((x) => !x.identique)).toBe(true);
  });
});
