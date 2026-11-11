import { describe, expect, it } from 'vitest';
import { CONFIG_HEXAVIA } from './config';
import { buildPrompt, finalNote, isModified, parseModelOutput, simulateProposal, totalScore } from './scoring';
import { computeShortlist } from './shortlist';
import { makeIdea } from './testUtils';
import type { Evaluation } from './types';

const notes = (impact: number, faisabilite: number, alignement: number, innovation: number) => ({ impact, faisabilite, alignement, innovation });
const just = { impact: 'a', faisabilite: 'b', alignement: 'c', innovation: 'd' };
const evalAi = (id: string, n: ReturnType<typeof notes>, manuelles = {}): Evaluation => ({
  ideaId: id, manuelles, commentaire: '', validee: false,
  ai: { notes: n, justifications: just, source: 'simulation', generatedAt: '' },
});

describe('parseModelOutput', () => {
  it('accepte une réponse conforme, en objet ou en texte', () => {
    expect(parseModelOutput({ notes: notes(1, 2, 3, 5), justifications: just }).ok).toBe(true);
    expect(parseModelOutput(JSON.stringify({ notes: notes(1, 2, 3, 5), justifications: just })).ok).toBe(true);
  });
  it.each([
    ['note hors grille', { notes: notes(6, 2, 3, 4), justifications: just }],
    ['note décimale', { notes: notes(2.5, 2, 3, 4), justifications: just }],
    ['critère manquant', { notes: { impact: 3, faisabilite: 3, alignement: 3 }, justifications: just }],
    ['justification vide', { notes: notes(3, 3, 3, 3), justifications: { ...just, impact: '  ' } }],
    ['texte non JSON', 'Je pense que cette idée vaut 4/5'],
  ])('refuse : %s', (_, raw) => expect(parseModelOutput(raw).ok).toBe(false));
});

describe('notes finales', () => {
  it('la note de Camille remplace la proposition, sans l\'effacer', () => {
    const ev = evalAi('A', notes(2, 3, 4, 5), { impact: 4 });
    expect(finalNote(ev, 'impact')).toBe(4);
    expect(finalNote(ev, 'faisabilite')).toBe(3);
    expect(ev.ai!.notes.impact).toBe(2);
    expect(isModified(ev, 'impact')).toBe(true);
    expect(isModified(ev, 'faisabilite')).toBe(false);
  });
  it('calcule la moyenne pondérée sur 5', () => {
    expect(totalScore(evalAi('A', notes(2, 3, 4, 5)), CONFIG_HEXAVIA)).toBe(3.5);
    const pondere = { ...CONFIG_HEXAVIA, criteres: CONFIG_HEXAVIA.criteres.map((c) => ({ ...c, poids: c.id === 'impact' ? 2 : 1 })) };
    expect(totalScore(evalAi('A', notes(5, 1, 1, 1)), pondere)).toBe(2.6);
  });
  it("n'a pas de total tant qu'un critère manque", () => {
    expect(totalScore(undefined, CONFIG_HEXAVIA)).toBeNull();
    expect(totalScore({ ideaId: 'A', manuelles: { impact: 3 }, commentaire: '', validee: false }, CONFIG_HEXAVIA)).toBeNull();
  });
});

describe('simulation du modèle', () => {
  const forte = makeIdea('A', 'Capteurs de vibration sur les presses', 'Installer des capteurs connectés pour détecter les pannes et réduire les arrêts.', {
    benefices: 'Réduire les arrêts non planifiés de 30 % et les coûts de maintenance', budgetBrut: '8 000 €', budgetEur: 8000,
  });
  const faible = makeIdea('B', 'Machine à café', 'Une machine en plus.', { benefices: '', budgetBrut: '', budgetEur: null });
  const chere = makeIdea('C', 'Jumeau numérique', 'Créer un jumeau numérique complet de l\'usine avec intelligence artificielle.', { budgetBrut: '2 M€', budgetEur: 2_000_000 });

  it('produit une réponse au format du modèle réel', () => {
    for (const idea of [forte, faible, chere]) {
      const p = simulateProposal(idea, CONFIG_HEXAVIA);
      expect(parseModelOutput({ notes: p.notes, justifications: p.justifications }).ok).toBe(true);
      expect(p.source).toBe('simulation');
    }
  });
  it('est déterministe (même idée, même note)', () => {
    expect(simulateProposal(forte, CONFIG_HEXAVIA).notes).toEqual(simulateProposal(forte, CONFIG_HEXAVIA).notes);
  });
  it('classe une idée chiffrée et alignée au-dessus d\'une idée vague', () => {
    const a = simulateProposal(forte, CONFIG_HEXAVIA).notes;
    const b = simulateProposal(faible, CONFIG_HEXAVIA).notes;
    expect(a.impact).toBeGreaterThan(b.impact);
    expect(a.alignement).toBeGreaterThan(b.alignement);
  });
  it('pénalise la faisabilité d\'un projet coûteux et complexe, et le justifie', () => {
    const p = simulateProposal(chere, CONFIG_HEXAVIA);
    expect(p.notes.faisabilite).toBe(1);
    expect(p.justifications.faisabilite).toMatch(/2\s000\s000/);
    expect(simulateProposal(faible, CONFIG_HEXAVIA).justifications.impact).toMatch(/Aucun bénéfice/);
    expect(simulateProposal(forte, CONFIG_HEXAVIA).justifications.impact).toContain('disponibilité des machines');
  });
});

describe('prompt envoyé au modèle réel', () => {
  it("ne contient jamais le nom ni le prénom de l'auteur", () => {
    const idea = makeIdea('A', 'Titre', 'Desc', { prenom: 'Mathilde', nom: 'Zorgensen' });
    const prompt = buildPrompt(idea, CONFIG_HEXAVIA);
    expect(prompt).not.toMatch(/Mathilde|Zorgensen/);
    expect(prompt).toContain('Titre');
  });
});

describe('shortlist', () => {
  const ideas = 'ABCDEFGHIJ'.split('').map((id) => makeIdea(id, id, id));
  const evaluations: Record<string, Evaluation> = Object.fromEntries(
    ideas.map((x, i) => [x.id, evalAi(x.id, notes(5 - (i % 5), 3, 3, 3))]),
  );
  const config = { ...CONFIG_HEXAVIA, tailleShortlist: 3 };
  const empty = { doublonDe: {}, forcees: {} };

  it('retient les meilleures, départage par l\'impact puis l\'ordre', () => {
    const s = computeShortlist(ideas, evaluations, empty, config);
    expect(s.retenues.map((r) => r.idea.id)).toEqual(['A', 'F', 'B']);
    expect(s.reserve.map((r) => r.idea.id)).toEqual(['G', 'C', 'H']);
  });
  it('exclut les doublons et les idées écartées', () => {
    const s = computeShortlist(ideas, evaluations, { doublonDe: { A: 'F' }, forcees: { B: 'out' } }, config);
    expect(s.retenues.map((r) => r.idea.id)).toEqual(['F', 'G', 'C']);
  });
  it('garde une idée forcée même mal notée, sans dépasser la taille', () => {
    const s = computeShortlist(ideas, evaluations, { doublonDe: {}, forcees: { E: 'in' } }, config);
    expect(s.retenues).toHaveLength(3);
    expect(s.retenues.map((r) => r.idea.id)).toContain('E');
  });
  it('liste les idées pas encore notées', () => {
    const s = computeShortlist([...ideas, makeIdea('Z', 'z', 'z')], evaluations, empty, config);
    expect(s.nonNotees.map((i) => i.id)).toEqual(['Z']);
  });
});

describe('cas constatés sur l\'export réel', () => {
  it('« nouveaux » ne déclenche pas l\'axe décarbonation (mot-clé « eau »), ni « recommander » l\'axe client', () => {
    const idea = makeIdea('X', 'Programme ambassadeurs', 'Proposer de nous recommander en échange d\'avantages.', { benefices: 'Nouveaux clients' });
    const p = simulateProposal(idea, CONFIG_HEXAVIA);
    expect(p.justifications.alignement).not.toMatch(/Décarbonation/);
    expect(p.justifications.alignement).toMatch(/Satisfaction client/); // via « clients »
    expect(p.justifications.innovation).toMatch(/incrémentale/);
    expect(p.justifications.impact).toMatch(/très général/);
  });

  it('valorise un constat mesuré et un bénéfice exprimé en mots (« divisé par deux »)', () => {
    const idea = makeIdea('Y', 'Îlots', "J'ai mesuré sur une semaine : 60 % du temps de passage est de l'attente.", { benefices: 'Temps de passage divisé par deux' });
    const p = simulateProposal(idea, CONFIG_HEXAVIA);
    expect(p.justifications.impact).toMatch(/Bénéfice chiffré : « Temps de passage divisé par deux »/);
    expect(p.justifications.impact).toMatch(/constat mesuré/);
    expect(p.notes.impact).toBeGreaterThanOrEqual(4);
  });
});
