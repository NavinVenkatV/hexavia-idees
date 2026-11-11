/** Minuscules, sans accents, espaces normalisés. Sert aux comparaisons, jamais à l'affichage. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nettoyage d'affichage : espaces en trop, espaces insécables. */
export function cleanLabel(s: string | undefined | null): string {
  return (s ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Clé de regroupement : « R&D », « r & d », « R & D » donnent la même clé. */
export function labelKey(s: string): string {
  return normalizeText(s)
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Regroupe les variantes d'un même libellé (casse, accents, espaces) sous la forme la
 * plus fréquente. Retourne la table variante → forme canonique.
 */
export function canonicalizeLabels(values: string[]): Map<string, string> {
  const groups = new Map<string, Map<string, number>>();
  for (const v of values) {
    const clean = cleanLabel(v);
    if (!clean) continue;
    const key = labelKey(clean);
    const g = groups.get(key) ?? new Map<string, number>();
    g.set(clean, (g.get(clean) ?? 0) + 1);
    groups.set(key, g);
  }
  const result = new Map<string, string>();
  for (const g of groups.values()) {
    // forme la plus fréquente ; à égalité, celle qui a des majuscules/accents (plus soignée)
    const best = [...g.entries()].sort(
      (a, b) => b[1] - a[1] || richness(b[0]) - richness(a[0]),
    )[0][0];
    for (const variant of g.keys()) result.set(variant, best);
  }
  return result;
}

function richness(s: string): number {
  return (s.match(/[A-ZÀ-Ý]/g)?.length ?? 0) + (s.match(/[à-ÿ]/g)?.length ?? 0);
}

const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/** Lit les formats de date courants d'un export (ISO, JJ/MM/AAAA, « 12 septembre 2026 »). */
export function parseDate(raw: string): string | null {
  const s = normalizeText(raw);
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else if ((match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    [d, m, y] = [+match[1], +match[2], +match[3]];
    if (y < 100) y += 2000;
  } else if ((match = s.match(/^(\d{1,2})(?:er)? ([a-z]+) (\d{4})/)) && MOIS[match[2]]) {
    [d, m, y] = [+match[1], MOIS[match[2]], +match[3]];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Lit un budget saisi librement : « 15 000 € », « 15k€ », « 1,5 M€ », « entre 10 et 20 k€ »,
 * « < 5000 € ». Une fourchette donne son milieu. Retourne null si rien de chiffrable.
 */
export function parseBudget(raw: string): number | null {
  const s = normalizeText(raw).replace(/[  ]/g, ' ');
  if (!s) return null;
  // nombres avec séparateurs de milliers (espace, point) et décimales (virgule ou point)
  const re = /(\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|m(?!o)|millions?|mille)?/g;
  const values: number[] = [];
  let lastUnit: string | undefined;
  const found: { n: number; unit?: string }[] = [];
  for (const m of s.matchAll(re)) {
    let numStr = m[1];
    if (/^\d{1,3}(?:[ .]\d{3})+$/.test(numStr)) numStr = numStr.replace(/[ .]/g, '');
    else numStr = numStr.replace(',', '.');
    found.push({ n: parseFloat(numStr), unit: m[2] });
  }
  if (found.length === 0) return null;
  // « entre 10 et 20 k€ » : l'unité finale s'applique aux nombres sans unité
  for (let i = found.length - 1; i >= 0; i--) {
    if (found[i].unit) lastUnit = found[i].unit;
    else if (lastUnit) found[i].unit = lastUnit;
  }
  for (const { n, unit } of found) {
    const mult = !unit ? 1 : unit === 'k' || unit === 'mille' ? 1_000 : 1_000_000;
    values.push(n * mult);
  }
  const range = values.slice(0, 2);
  const v = range.length === 2 ? (range[0] + range[1]) / 2 : range[0];
  return Number.isFinite(v) ? Math.round(v) : null;
}

export function formatEuros(v: number | null): string {
  if (v === null) return 'Non chiffré';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(v);
}
