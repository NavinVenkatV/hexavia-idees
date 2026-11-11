import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeFile, ImportError, parseIdeasCsv } from './csv';
import { canonicalizeLabels, parseBudget, parseDate } from './normalize';

const fixture = readFileSync(join(__dirname, '__fixtures__/idees_test.csv'));
const bytes = fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength);

describe('parseDate', () => {
  it.each([
    ['2026-09-02', '2026-09-02'],
    ['03/09/2026', '2026-09-03'],
    ['3/9/26', '2026-09-03'],
    ['2026/09/20', '2026-09-20'],
    ['12 septembre 2026', '2026-09-12'],
    ['1er août 2026', '2026-08-01'],
    ['2026-09-02 14:32', '2026-09-02'],
  ])('lit « %s »', (raw, iso) => expect(parseDate(raw)).toBe(iso));

  it.each(['31/02/2026', 'hier', '', '2026-13-01'])('refuse « %s »', (raw) =>
    expect(parseDate(raw)).toBeNull(),
  );
});

describe('parseBudget', () => {
  it.each([
    ['45 000 €', 45000],
    ['45 000 €', 45000],
    ['5k€', 5000],
    ['15 K€', 15000],
    ['1,2 M€', 1_200_000],
    ['entre 30 et 50 k€', 40000],
    ['10 000 - 20 000 €', 15000],
    ['< 5000 €', 5000],
    ['~2000', 2000],
    ['1.000.000 euros', 1_000_000],
  ])('lit « %s »', (raw, v) => expect(parseBudget(raw)).toBe(v));

  it.each(['non estimé', '?', '', 'faible', 'à définir'])('« %s » n\'est pas chiffrable', (raw) =>
    expect(parseBudget(raw)).toBeNull(),
  );
});

describe('canonicalizeLabels', () => {
  it('regroupe casse, espaces et « & »', () => {
    const map = canonicalizeLabels(['R&D', 'r & d', 'R&D', 'Production', 'production ']);
    expect(map.get('r & d')).toBe('R&D');
    expect(map.get('production')).toBe('Production');
  });
});

describe('import du CSV', () => {
  const { ideas, warnings } = parseIdeasCsv(decodeFile(bytes));

  it('ignore les lignes vides et garde les autres', () => {
    expect(ideas).toHaveLength(6);
  });

  it('gère le BOM, les guillemets, les « ; » et retours à la ligne dans un champ', () => {
    expect(ideas[0].id).toBe('IDEA-001');
    expect(ideas[0].description).toContain('arrivent; maintenance');
    expect(ideas[1].description).toContain("\nLes alertes iraient au chef d'équipe.");
  });

  it('attribue un identifiant aux lignes sans id ou en double, et le signale', () => {
    expect(ideas[3].id).toMatch(/^LIGNE-/);
    expect(ideas[4].id).toMatch(/^LIGNE-/);
    expect(warnings.some((w) => w.message.includes('Identifiant manquant'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('IDEA-003 en double'))).toBe(true);
  });

  it('harmonise directions et thèmes', () => {
    expect(new Set(ideas.map((i) => i.direction))).toEqual(new Set(['Production', 'RH', 'Achats', 'R&D']));
    expect(ideas[1].theme).toBe('Excellence opérationnelle');
  });

  it('lit dates et budgets, et signale les dates impossibles', () => {
    expect(ideas[2].dateDepot).toBe('2026-09-12');
    expect(ideas[1].budgetEur).toBe(40000);
    expect(ideas[4].budgetEur).toBe(1_200_000);
    expect(ideas[5].dateDepot).toBeNull();
    expect(warnings.some((w) => w.message.includes('31/02/2026'))).toBe(true);
  });

  it('accepte un export Windows-1252 (Excel)', () => {
    const latin1 = new Uint8Array([...'titre;description\nCaf'].map((c) => c.charCodeAt(0)).concat([0xe9, 0x3b, 0x78]));
    const { ideas: x } = parseIdeasCsv(decodeFile(latin1.buffer));
    expect(x[0].titre).toBe('Café');
  });

  it('accepte des en-têtes avec accents et un séparateur virgule', () => {
    const { ideas: x } = parseIdeasCsv('Titre,Description,Bénéfices attendus\nA,B,C');
    expect(x[0].benefices).toBe('C');
  });

  it('refuse un fichier vide ou sans les colonnes attendues, avec un message clair', () => {
    expect(() => parseIdeasCsv('')).toThrow(ImportError);
    expect(() => parseIdeasCsv('nom;prenom\nA;B')).toThrow(/Colonnes introuvables : titre, description/);
  });
});
