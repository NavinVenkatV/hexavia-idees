# CLAUDE.md — instructions pour l'assistant

## Contexte
Outil de tri d'idées pour les challenges d'innovation accompagnés par INSKIP.
Première utilisatrice : Camille, consultante, **non technique**. Premier client : Hexavia
(40 idées, export CSV séparé par `;`). L'outil doit être réutilisable pour d'autres clients.

## Stack
React 19 + TypeScript + Vite. Tests : Vitest. Déploiement : Vercel (fonction `api/score.ts`
pour l'IA réelle, optionnelle). Pas de backend de données : tout reste dans le navigateur.

## Règles
- **Logique métier dans `src/domain/`**, en fonctions pures, sans React. Chaque fonction
  de `domain/` a des tests dans `src/domain/*.test.ts`. On écrit le test avec la modification.
- **Les composants ne contiennent pas de logique métier** : ils appellent `domain/`.
- **Aucun secret dans le dépôt.** La clé IA se lit uniquement côté serveur
  (`process.env.ANTHROPIC_API_KEY` dans `api/`). Jamais de `VITE_*` pour une clé : tout
  `VITE_*` finit dans le bundle public.
- **Données personnelles** : ne jamais committer de vrai export (`*.csv` est ignoré, sauf
  `src/domain/__fixtures__/`). Ne jamais envoyer nom/prénom à l'IA. Ne rien logger qui
  contienne un nom.
- **Interface en français**, libellés courts et sans jargon (pas de « parse », « JSON »,
  « score IA » → « note proposée »). Prévoir état vide, état d'erreur, état de chargement.
- **Ne jamais écraser une note saisie par Camille** avec une proposition de l'IA.
- Petits commits, message en français, un sujet par commit. `npm test` et `npm run build`
  doivent passer avant chaque commit.
- Ne pas ajouter de dépendance sans raison écrite dans le README (partie Conception).

## Commandes
- `npm run dev` : lancer en local
- `npm test` : tests Vitest
- `npm run build` : vérification TypeScript + build
