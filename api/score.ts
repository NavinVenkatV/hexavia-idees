/**
 * Fonction serveur Vercel : propose une note pour une idée avec un vrai modèle Claude.
 *
 * - Inactive tant que ANTHROPIC_API_KEY n'est pas renseignée (répond 503) : l'application
 *   utilise alors la simulation côté navigateur.
 * - La clé ne quitte jamais le serveur (pas de préfixe VITE_).
 * - Le navigateur n'envoie pas l'auteur ; on le retire quand même ici par sécurité.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { CONFIG_HEXAVIA } from '../src/domain/config.js';
import { buildPrompt, ModelOutputSchema } from '../src/domain/scoring.js';
import type { Idea } from '../src/domain/types.js';

const RequestSchema = z.object({
  idea: z.object({
    id: z.string().max(50),
    titre: z.string().max(500),
    description: z.string().max(5000),
    benefices: z.string().max(3000),
    budgetBrut: z.string().max(200),
    theme: z.string().max(200),
    direction: z.string().max(200),
  }),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'not_configured' });

  const body = RequestSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_request' });

  const idea: Idea = {
    ...body.data.idea,
    prenom: '', nom: '', site: '', dateDepot: null, dateBrute: '', budgetEur: null,
  };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(ModelOutputSchema) },
      messages: [{ role: 'user', content: buildPrompt(idea, CONFIG_HEXAVIA) }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return res.status(502).json({ error: 'no_proposal' });
    }
    return res.status(200).json({ ...response.parsed_output, source: 'claude', generatedAt: new Date().toISOString() });
  } catch (e) {
    // On ne journalise pas le contenu de l'idée.
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    console.error('score: appel au modèle en échec', status);
    return res.status(502).json({ error: 'model_error' });
  }
}
