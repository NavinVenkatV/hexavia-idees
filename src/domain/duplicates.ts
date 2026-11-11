import type { Idea } from './types';
import { normalizeText } from './normalize';

/** Mots trop courants pour distinguer deux idées. */
const STOPWORDS = new Set(
  `a au aux avec ce ces cette dans de des du elle en et etre il ils je la le les leur leurs
  lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses
  son sur ta te tes toi ton tu un une vos votre vous c d j l m n s t y ete afin plus moins
  tres tout tous toute toutes sans sous entre chaque comme aussi faire fait permet permettre
  mettre mise place idee proposer propose propose nouvelle nouveau nouveaux nouvelles via
  quand donc car si ainsi lors leurs avant apres deja bien peu beaucoup iraient serait
  salaries salarie entreprise site sites`.split(/\s+/),
);

/** Racinisation légère : pluriels et quelques suffixes fréquents. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4) w = w.replace(/(aux)$/, 'al');
  if (w.length > 4) w = w.replace(/(s|x)$/, '');
  if (w.length > 6) w = w.replace(/(ement|ation|ations|ique|iques|euse|eur|ive|if|ee|e)$/, '');
  return w;
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

export interface DuplicatePair {
  a: string;
  b: string;
  /** Similarité de 0 à 1. */
  score: number;
  /** Mots communs les plus parlants, pour expliquer le rapprochement à Camille. */
  motsCommuns: string[];
}

/**
 * Repère les paires d'idées proches : similarité cosinus TF-IDF sur titre (compté double)
 * + description. Le TF-IDF donne moins de poids aux mots présents dans toutes les idées.
 */
export function findDuplicates(ideas: Idea[], seuil = 0.3): DuplicatePair[] {
  const docs = ideas.map((i) => {
    const titre = tokenize(i.titre);
    return [...titre, ...titre, ...tokenize(i.description)];
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const vectors = docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    const v = new Map<string, number>();
    for (const [t, c] of tf) v.set(t, c * Math.log(1 + n / (df.get(t) ?? 1)));
    const norm = Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;
    for (const [t, x] of v) v.set(t, x / norm);
    return v;
  });

  // forme lisible d'un mot racinisé : la première occurrence dans le texte d'origine
  const display = new Map<string, string>();
  for (const i of ideas) {
    for (const raw of normalizeText(`${i.titre} ${i.description}`).split(/[^a-z0-9]+/)) {
      const s = stem(raw);
      if (!display.has(s)) display.set(s, raw);
    }
  }

  const pairs: DuplicatePair[] = [];
  for (let x = 0; x < n; x++) {
    for (let y = x + 1; y < n; y++) {
      let score = 0;
      const shared: [string, number][] = [];
      for (const [t, w] of vectors[x]) {
        const w2 = vectors[y].get(t);
        if (w2) {
          score += w * w2;
          shared.push([t, w * w2]);
        }
      }
      if (score >= seuil) {
        pairs.push({
          a: ideas[x].id,
          b: ideas[y].id,
          score: Math.round(score * 100) / 100,
          motsCommuns: shared.sort((p, q) => q[1] - p[1]).slice(0, 5).map(([t]) => display.get(t) ?? t),
        });
      }
    }
  }
  return pairs.sort((p, q) => q.score - p.score);
}

/** Regroupe les paires en groupes (A~B et B~C ⇒ {A, B, C}). */
export function groupDuplicates(pairs: DuplicatePair[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const { a, b } of pairs) parent.set(find(a), find(b));
  const groups = new Map<string, string[]>();
  for (const id of new Set(pairs.flatMap((p) => [p.a, p.b]))) {
    const r = find(id);
    groups.set(r, [...(groups.get(r) ?? []), id]);
  }
  return [...groups.values()].map((g) => g.sort());
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
