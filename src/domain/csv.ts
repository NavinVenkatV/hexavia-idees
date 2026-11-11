import Papa from 'papaparse';
import type { Idea, ImportResult, ImportWarning } from './types';
import { canonicalizeLabels, cleanLabel, normalizeText, parseBudget, parseDate } from './normalize';

/** Colonnes attendues et noms alternatifs acceptés (export de formulaire variable). */
const COLUMNS = {
  id: ['id', 'identifiant', 'ref'],
  date_depot: ['date_depot', 'date de depot', 'date', 'horodatage'],
  prenom: ['prenom'],
  nom: ['nom'],
  direction: ['direction'],
  site: ['site'],
  theme: ['theme', 'thematique'],
  titre: ['titre', "titre de l'idee", 'intitule'],
  description: ['description', "description de l'idee"],
  benefices_attendus: ['benefices_attendus', 'benefices attendus', 'benefices', 'gains attendus'],
  budget_estime: ['budget_estime', 'budget estime', 'budget'],
} as const;

type Column = keyof typeof COLUMNS;
const REQUIRED: Column[] = ['titre', 'description'];

export class ImportError extends Error {}

/** Décode le fichier : UTF-8 si valide, sinon Windows-1252 (export Excel français). */
export function decodeFile(bytes: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

function headerKey(h: string): string {
  return normalizeText(h).replace(/_/g, ' ').replace(/\s*\(.*\)\s*$/, '').trim();
}

function mapHeaders(headers: string[]): Partial<Record<Column, string>> {
  const map: Partial<Record<Column, string>> = {};
  for (const h of headers) {
    const k = headerKey(h);
    for (const [col, aliases] of Object.entries(COLUMNS) as [Column, readonly string[]][]) {
      if (!map[col] && aliases.some((a) => a.replace(/_/g, ' ') === k)) map[col] = h;
    }
  }
  return map;
}

/** Transforme le texte d'un export CSV en idées propres, avec la liste de ce qui a été corrigé. */
export function parseIdeasCsv(text: string): ImportResult {
  const clean = text.replace(/^﻿/, '');
  if (!clean.trim()) throw new ImportError('Le fichier est vide.');

  const firstLine = clean.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    delimiter,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const map = mapHeaders(headers);
  const missing = REQUIRED.filter((c) => !map[c]);
  if (missing.length > 0) {
    throw new ImportError(
      `Colonnes introuvables : ${missing.join(', ')}. Vérifiez qu'il s'agit bien de l'export du formulaire (séparateur point-virgule).`,
    );
  }

  const warnings: ImportWarning[] = [];
  for (const e of parsed.errors) {
    if (e.code === 'TooFewFields' || e.code === 'TooManyFields') {
      warnings.push({ ligne: (e.row ?? 0) + 2, message: 'Nombre de colonnes inattendu : ligne lue au mieux.' });
    }
  }

  const get = (row: Record<string, string>, col: Column) => cleanLabel(map[col] ? row[map[col]!] : '');
  const ids = new Set<string>();
  const rawIdeas: Idea[] = [];

  parsed.data.forEach((row, i) => {
    const ligne = i + 2; // +1 en-tête, +1 base 1
    const titre = get(row, 'titre');
    const description = (map.description ? row[map.description] ?? '' : '').trim();
    if (!titre && !description) {
      warnings.push({ ligne, message: 'Ligne sans titre ni description : ignorée.' });
      return;
    }
    let id = get(row, 'id').toUpperCase();
    if (!id || ids.has(id)) {
      const generated = `LIGNE-${String(ligne).padStart(3, '0')}`;
      warnings.push({
        ligne,
        message: id ? `Identifiant ${id} en double : renommé ${generated}.` : `Identifiant manquant : ${generated} attribué.`,
      });
      id = generated;
    }
    ids.add(id);
    const dateBrute = get(row, 'date_depot');
    const dateDepot = parseDate(dateBrute);
    if (dateBrute && !dateDepot) warnings.push({ ligne, message: `Date illisible : « ${dateBrute} ».` });
    for (const [col, label] of [['direction', 'Direction'], ['site', 'Site'], ['theme', 'Thème']] as const) {
      if (map[col] && !get(row, col)) warnings.push({ ligne, message: `${id} : ${label.toLowerCase()} non renseigné${col === 'direction' ? 'e' : ''}.` });
    }
    if (looksEnglish(`${titre} ${description}`)) {
      warnings.push({ ligne, message: `${id} : idée rédigée en anglais, à garder en tête pour la notation et la shortlist.` });
    }
    const budgetBrut = get(row, 'budget_estime');
    rawIdeas.push({
      id,
      dateDepot,
      dateBrute,
      prenom: get(row, 'prenom'),
      nom: get(row, 'nom'),
      direction: get(row, 'direction'),
      site: get(row, 'site'),
      theme: get(row, 'theme'),
      titre: titre || description.slice(0, 80),
      description,
      benefices: (map.benefices_attendus ? row[map.benefices_attendus] ?? '' : '').trim(),
      budgetBrut,
      budgetEur: parseBudget(budgetBrut),
    });
  });

  if (rawIdeas.length === 0) throw new ImportError("Aucune idée trouvée dans le fichier.");

  // Harmonise « Production » / « production » / « Production  » etc.
  const ideas = rawIdeas;
  for (const field of ['direction', 'site', 'theme'] as const) {
    const canon = canonicalizeLabels(ideas.map((x) => x[field]));
    const merged = new Map<string, Set<string>>();
    for (const idea of ideas) {
      const c = canon.get(idea[field]);
      if (c && c !== idea[field]) {
        const s = merged.get(c) ?? new Set();
        s.add(idea[field]);
        merged.set(c, s);
        idea[field] = c;
      }
    }
    for (const [c, variants] of merged) {
      warnings.push({ message: `${fieldLabel(field)} : ${[...variants].map((v) => `« ${v} »`).join(', ')} regroupé avec « ${c} ».` });
    }
  }

  return { ideas, warnings };
}

const EN = new Set(['the', 'of', 'to', 'and', 'for', 'with', 'under', 'find', 'build', 'one', 'our', 'is', 'are', 'this']);
const FR = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'et', 'pour', 'avec', 'un', 'une', 'sur', 'dans', 'est']);

/** Détection simple : davantage de mots-outils anglais que français. */
export function looksEnglish(text: string): boolean {
  const ws = normalizeText(text).split(/[^a-z]+/);
  const en = ws.filter((w) => EN.has(w)).length;
  return en >= 3 && en > ws.filter((w) => FR.has(w)).length;
}

function fieldLabel(f: 'direction' | 'site' | 'theme'): string {
  return f === 'direction' ? 'Direction' : f === 'site' ? 'Site' : 'Thème';
}
