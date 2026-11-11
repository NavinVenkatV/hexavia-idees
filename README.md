# Pépite : le tri des idées du challenge Hexavia

## Aperçu

**Application : https://hexavia-idees.vercel.app** · ![CI](https://github.com/NavinVenkatV/hexavia-idees/actions/workflows/ci.yml/badge.svg)

Camille importe l'export du formulaire, relit une note proposée pour chaque idée, écarte les doublons et envoie la shortlist au client.

| Idées et filtres | Notation : proposition puis correction | Shortlist prête à envoyer |
|---|---|---|
| ![Idées](docs/1-idees.png) | ![Notation](docs/2-notation.png) | ![Shortlist](docs/4-shortlist.png) |

## Lancer l'outil

```bash
npm install
npm run dev        # http://localhost:5173, puis déposer idees_hexavia.csv
npm test           # 80 tests unitaires
npm run test:e2e   # parcours complet dans un navigateur (Playwright)
```

Node 20 ou plus. Aucune configuration n'est nécessaire : l'IA tourne en simulation par défaut.

## 1. Cadrage

**Le besoin.** Camille doit présenter environ 8 idées sur 40 à un jury dans dix jours. Dans Excel, le dépouillement est long et sa notation manque de cohérence. Il lui faut un seul endroit pour lire et filtrer les idées, une première note justifiée sur la grille du client qu'elle peut corriger, le repérage des doublons et une shortlist présentable.

**Utilisateurs.** Camille, consultante non technique, seule sur son poste. Le client et le jury reçoivent la shortlist. Plus tard, d'autres consultants INSKIP.

**Hypothèses.** Les quatre critères pèsent autant. La stratégie d'Hexavia n'étant pas fournie, j'ai retenu cinq axes typiques d'un industriel (décarbonation, sécurité, excellence opérationnelle, numérique, client). L'IA propose, Camille décide : une note saisie n'est jamais écrasée. Un doublon écarté reste visible et chaque décision s'annule. Rien n'est supprimé à l'import : tout est signalé.

**V1 :** import robuste · filtres · note proposée et justifiée, corrigeable d'un clic · doublons par paires · shortlist classée avec ajustements manuels · export PDF et Excel · sauvegarde automatique.
**Plus tard :** vrai modèle activé · notation à plusieurs · grille modifiable dans l'interface · base partagée (Supabase).

## 2. Conception

Une application React + TypeScript + Vite (la stack d'INSKIP), sans base de données : tout reste dans le navigateur de Camille, y compris les noms des salariés. Une seule fonction serveur (`api/score.ts`) sert le jour où l'on branche un vrai modèle, et c'est elle qui détient la clé.

| Choix | Raison |
|---|---|
| Logique métier en fonctions pures (`src/domain/`) | Testable sans navigateur, réutilisée telle quelle par le serveur. |
| Notes de l'IA et notes de Camille stockées séparément | On voit toujours ce qu'elle a corrigé ; la note retenue est la sienne si elle existe. |
| Doublons par similarité de texte (TF-IDF) | Explicable (mots communs surlignés), instantané, sans clé. Camille garde la décision. |
| IA simulée au format exact du vrai modèle | Le même schéma valide les deux : passer au modèle réel ne change rien ailleurs. |
| Clé API côté serveur uniquement | Une variable `VITE_*` serait publiée dans le navigateur. Les noms ne sont jamais envoyés. |
| Configuration du challenge dans un seul fichier | Pour un autre client, on change `src/domain/config.ts` (grille, poids, axes). |

## 3. Construction avec l'IA

**Assistant :** Claude Code. Ses règles sont dans [`CLAUDE.md`](CLAUDE.md) : logique testée dans `domain/`, aucun secret, aucun nom envoyé à l'IA, interface en français sans jargon. Un module par commit, chacun avec ses tests ; relecture de chaque diff et vérification sur captures d'écran.

**Prompts les plus utiles :**
1. *« Écris d'abord un fichier de test avec tous les pièges d'un vrai export (BOM, `;` dans un champ, retour à la ligne, id manquant ou en double, date impossible, budget en texte libre), puis le parseur qui le passe. »*
2. *« La simulation doit renvoyer exactement le format du vrai modèle, et chaque justification doit citer l'idée. »*
3. *« Prouve par un test que le prompt envoyé au modèle ne contient ni nom ni prénom. »*
4. *« Prends des captures de chaque écran et relis-les comme si tu étais Camille. »*

**Quand l'IA s'est trompée :**
- **Sur le vrai fichier, des notes fausses.** Les tests passaient sur mes données d'exemple, mais « Programme ambassadeurs clients » obtenait un bon alignement stratégique : le mot-clé `eau` était trouvé dans « nouv**eau**x ». Correction : recherche en début de mot, avec un test. Même révélation pour deux paires de doublons manquées (« chatbot » / « assistant conversationnel ») : table de synonymes.
- **En ligne, une fonction en panne.** `/api/score` répondait 500 sur Vercel alors que tout passait en local (imports sans extension, refusés par Node). Repéré en interrogeant l'URL après déploiement.

## 4. Fiabilisation

**80 tests unitaires** sur ce qui compte : l'import (encodages, séparateurs, champs sur plusieurs lignes, 7 formats de date, 15 formats de budget, messages d'erreur), la notation (réponse de modèle invalide refusée, note de Camille prioritaire, aucun nom dans le prompt), les doublons, la shortlist, l'export (formules Excel neutralisées, anonymisation). **Un test de bout en bout** rejoue le parcours de Camille dans un navigateur.

**Sur l'export réel :** 40 idées importées, 4 points signalés. Les 5 paires plausibles de doublons ont un score ≥ 0,34 et le premier faux positif arrive à 0,21 : le seuil est fixé à 0,30.

**La CI** ([`ci.yml`](.github/workflows/ci.yml)), à chaque push : refus de toute clé, `.env` ou export CSV committé, lint, build, tests unitaires et de bout en bout.

## 5. Livraison

**Configuration** ([`.env.example`](.env.example)) : rien par défaut. Pour un vrai modèle, définir `ANTHROPIC_API_KEY` et `VITE_AI_MODE=claude` dans Vercel.

**Avant de confier l'outil à Camille :** valider avec elle la grille et les axes stratégiques · protéger `/api/score` (authentification) avant d'y mettre une clé · la prévenir que les données vivent dans son navigateur et s'effacent avec lui.

## 6. Journal

| Heure | Étape |
|---|---|
| 01:40 | Cadrage, stack, `CLAUDE.md` |
| 01:48 → 01:52 | Import, doublons, notation, export, IA branchable (avec tests) |
| 01:58 | Interface, test de bout en bout, CI |
| 02:07 | Export réel reçu : corrections révélées par la vraie donnée |
| 02:25 → 02:40 | Finition de l'interface (navigation, indicateurs, mobile) |
| 02:50 | Mise en ligne, correction de la fonction serveur |

## 7. Suite et questions pour Camille

**Avec une journée de plus :** brancher le vrai modèle derrière une authentification et comparer ses notes aux miennes · écran de paramètres du challenge · notation à plusieurs (Supabase) · export PowerPoint pour le jury.

**Questions :**
1. Quelles sont les priorités stratégiques d'Hexavia ? Un critère compte-t-il plus ?
2. Le jury voit-il le nom des auteurs ou note-t-il à l'aveugle ?
3. Covoiturage domicile-travail (IDEA-008) et inter-sites (IDEA-027) : une idée ou deux ?
4. Sous quelle forme le client veut-il la shortlist ?
5. Le client accepte-t-il que les idées passent par un modèle d'IA externe, même anonymisées ?
