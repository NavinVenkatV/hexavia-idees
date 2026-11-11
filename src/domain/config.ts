import type { ChallengeConfig, Criterion } from './types';

/** Grille d'évaluation du client (e-mail de Camille). Poids égaux par hypothèse. */
export const CRITERES_HEXAVIA: Criterion[] = [
  { id: 'impact', label: 'Impact', question: "Quel gain pour l'entreprise ?", poids: 1 },
  { id: 'faisabilite', label: 'Faisabilité', question: 'Peut-on le mettre en œuvre facilement ?', poids: 1 },
  { id: 'alignement', label: 'Alignement stratégique', question: 'Est-ce aligné avec la stratégie du groupe ?', poids: 1 },
  { id: 'innovation', label: 'Caractère innovant', question: "Est-ce nouveau pour l'entreprise ?", poids: 1 },
];

/**
 * Hypothèse : la stratégie d'Hexavia n'est pas fournie. On retient les priorités typiques
 * d'un groupe industriel ; à faire valider par Camille (voir README, questions).
 */
export const CONFIG_HEXAVIA: ChallengeConfig = {
  nom: 'Challenge innovation Hexavia',
  client: 'Hexavia',
  criteres: CRITERES_HEXAVIA,
  tailleShortlist: 8,
  axesStrategiques: [
    {
      label: 'Décarbonation et sobriété',
      motsCles: ['co2', 'carbone', 'energie', 'energetique', 'emission', 'dechet', 'recycl', 'eau', 'sobriete', 'solaire', 'electrique', 'environnement', 'climat'],
    },
    {
      label: 'Sécurité au travail',
      motsCles: ['securite', 'accident', 'risque', 'ergonom', 'sante', 'epi', 'chute', 'blessure', 'prevention'],
    },
    {
      label: 'Excellence opérationnelle',
      motsCles: ['productivite', 'qualite', 'rebut', 'panne', 'arret', 'maintenance', 'delai', 'stock', 'flux', 'lean', 'cadence', 'cout'],
    },
    {
      label: 'Transformation numérique',
      motsCles: ['numerique', 'digital', 'donnee', 'capteur', 'automatis', 'application', 'logiciel', 'ia ', 'intelligence artificielle', 'connecte', 'jumeau'],
    },
    {
      label: 'Satisfaction client',
      motsCles: ['client', 'livraison', 'service', 'satisfaction', 'reclamation', 'commande'],
    },
  ],
};
