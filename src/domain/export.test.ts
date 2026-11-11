import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { CONFIG_HEXAVIA } from './config';
import { csvCell, shortlistToCsv } from './export';
import { makeIdea } from './testUtils';
import type { Evaluation } from './types';

describe('csvCell', () => {
  it('protège les « ; », guillemets et retours à la ligne', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('il a dit "oui"')).toBe('"il a dit ""oui"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralise les formules Excel', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toMatch(/^"'=/);
    expect(csvCell('-15 % de CO2')).toBe("'-15 % de CO2");
    expect(csvCell('+33 6')).toBe("'+33 6");
  });
});

describe('export de la shortlist', () => {
  const idea = makeIdea('IDEA-007', 'Tri; sélectif', '=1+1', { prenom: 'Lina', nom: 'Martin', budgetEur: 45000, budgetBrut: '45k€' });
  const ev: Evaluation = {
    ideaId: idea.id, manuelles: { impact: 5 }, commentaire: 'Coup de cœur', validee: true,
    ai: { notes: { impact: 3, faisabilite: 4, alignement: 4, innovation: 3 }, justifications: { impact: 'a', faisabilite: 'b', alignement: 'c', innovation: 'd' }, source: 'simulation', generatedAt: '' },
  };
  const retenues = [{ idea, total: 4, rang: 1, forcee: false }];

  it("se relit en CSV avec les notes finales (celles de Camille) et un BOM pour Excel", () => {
    const csv = shortlistToCsv(retenues, { [idea.id]: ev }, CONFIG_HEXAVIA, { anonymiser: false });
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = Papa.parse<string[]>(csv.slice(1), { delimiter: ';' }).data;
    expect(rows[0]).toContain('Auteur');
    expect(rows[1][2]).toBe('Tri; sélectif');
    expect(rows[1][6]).toBe('Lina Martin');
    expect(rows[1][7]).toBe('5'); // impact corrigé par Camille, pas la proposition (3)
    expect(rows[1][11]).toBe('4,0');
    expect(rows[1][12]).toBe('45 000 €');
    expect(rows[1][13]).toBe("'=1+1");
  });

  it("n'inclut aucun nom quand on anonymise", () => {
    const csv = shortlistToCsv(retenues, { [idea.id]: ev }, CONFIG_HEXAVIA, { anonymiser: true });
    expect(csv).not.toMatch(/Lina|Martin|Auteur/);
  });
});
