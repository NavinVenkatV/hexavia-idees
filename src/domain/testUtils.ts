import type { Idea } from './types';

export function makeIdea(id: string, titre: string, description: string, extra: Partial<Idea> = {}): Idea {
  return {
    id, titre, description,
    dateDepot: '2026-09-01', dateBrute: '2026-09-01',
    prenom: 'Test', nom: 'Test', direction: 'Production', site: 'Lyon', theme: 'Excellence opérationnelle',
    benefices: '', budgetBrut: '', budgetEur: null,
    ...extra,
  };
}
