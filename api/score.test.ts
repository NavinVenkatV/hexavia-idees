import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it } from 'vitest';
import handler from './score';

function call(body: unknown, method = 'POST') {
  const res = { statusCode: 0, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return handler({ method, body } as VercelRequest, res as unknown as VercelResponse).then(() => res);
}
const idea = { id: 'IDEA-001', titre: 't', description: 'd', benefices: '', budgetBrut: '', theme: '', direction: '' };

describe('/api/score', () => {
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it('sans clé configurée, répond 503 (le navigateur garde la simulation)', async () => {
    expect((await call({ idea })).statusCode).toBe(503);
  });
  it('refuse une requête mal formée', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    expect((await call({ idea: { titre: 1 } })).statusCode).toBe(400);
    expect((await call({ idea }, 'GET')).statusCode).toBe(405);
  });
});
