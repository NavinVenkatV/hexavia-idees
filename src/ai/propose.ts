import { parseModelOutput, simulateProposal } from '../domain/scoring';
import type { AiProposal, ChallengeConfig, Idea } from '../domain/types';

/**
 * Mode de l'IA, choisi par configuration (voir .env.example) :
 * - « simulation » (défaut) : notes calculées dans le navigateur, aucune donnée ne sort ;
 * - « claude » : appel à /api/score, qui détient la clé côté serveur.
 */
export const AI_MODE: 'simulation' | 'claude' = import.meta.env.VITE_AI_MODE === 'claude' ? 'claude' : 'simulation';

async function proposeWithClaude(idea: Idea): Promise<AiProposal> {
  // Minimisation : ni nom, ni prénom, ni site ne partent vers le serveur.
  const { id, titre, description, benefices, budgetBrut, theme, direction } = idea;
  const res = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea: { id, titre, description, benefices, budgetBrut, theme, direction } }),
  });
  if (!res.ok) throw new Error(res.status === 503 ? 'IA non configurée' : 'IA indisponible');
  const data = await res.json();
  const parsed = parseModelOutput(data);
  if (!parsed.ok) throw new Error(parsed.error);
  return { ...parsed.value, source: 'claude', generatedAt: data.generatedAt ?? new Date().toISOString() };
}

export async function propose(idea: Idea, config: ChallengeConfig): Promise<AiProposal> {
  if (AI_MODE === 'claude') return proposeWithClaude(idea);
  // petite attente pour que la progression reste lisible, comme avec un vrai modèle
  await new Promise((r) => setTimeout(r, 40));
  return simulateProposal(idea, config);
}

/** Lance les propositions par petits lots ; renvoie le nombre d'échecs. */
export async function proposeAll(
  ideas: Idea[],
  config: ChallengeConfig,
  onResult: (ideaId: string, p: AiProposal) => void,
  onProgress: (done: number) => void,
): Promise<number> {
  let done = 0;
  let failed = 0;
  const queue = [...ideas];
  const worker = async () => {
    for (let idea = queue.shift(); idea; idea = queue.shift()) {
      try {
        onResult(idea.id, await propose(idea, config));
      } catch {
        failed++;
      }
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return failed;
}
