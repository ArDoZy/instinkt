/**
 * Tables d'équilibrage et données statiques.
 * Tout ce qui est chiffré et susceptible d'être ajusté vit ici.
 */

export const BIOMES = /** @type {const} */ ({
  FORET: 'foret',
  JUNGLE: 'jungle',
  PLAINE: 'plaine',
  DESERT: 'desert',
  MONTAGNE: 'montagne',
});

export const BIOME_LIST = [
  BIOMES.FORET,
  BIOMES.JUNGLE,
  BIOMES.PLAINE,
  BIOMES.DESERT,
  BIOMES.MONTAGNE,
];

export const BIOME_META = {
  [BIOMES.FORET]: { label: 'Forêt', short: 'F', color: '--mousse', visionMod: -1, passable: true },
  [BIOMES.JUNGLE]: { label: 'Jungle', short: 'J', color: '--jungle', visionMod: -2, passable: true },
  [BIOMES.PLAINE]: { label: 'Plaine', short: 'P', color: '--herbe', visionMod: +1, passable: true },
  [BIOMES.DESERT]: { label: 'Désert', short: 'D', color: '--sable', visionMod: +2, passable: true },
  [BIOMES.MONTAGNE]: { label: 'Montagne', short: 'M', color: '--roche', visionMod: 0, passable: false },
};

export const INSTINCTS = /** @type {const} */ ({
  FUYARD: 'fuyard',
  CHAROGNARD: 'charognard',
  PROTECTEUR: 'protecteur',
  TERRITORIAL: 'territorial',
  DOMINANT: 'dominant',
  CHASSEUR: 'chasseur',
});

export const INSTINCT_LIST = [
  INSTINCTS.FUYARD,
  INSTINCTS.CHAROGNARD,
  INSTINCTS.PROTECTEUR,
  INSTINCTS.TERRITORIAL,
  INSTINCTS.DOMINANT,
  INSTINCTS.CHASSEUR,
];

export const BALANCE = {
  board: {
    width: 8,
    height: 8,
    /** Cases libres (non-montagne) minimum par moitié de plateau. */
    minFreeCellsPerHalf: 8,
    minRegions: 4,
    maxRegions: 7,
    /** Part maximale de montagne sur le plateau : au-delà, la partie s'étrique. */
    maxMountainRatio: 0.22,
    /** Part maximale d'une seule région : évite les plateaux monochromes. */
    maxRegionRatio: 0.45,
    /** Nombre de biomes distincts exigés : un plateau doit offrir des choix. */
    minDistinctBiomes: 3,
    minSeeds: 6,
    maxSeeds: 9,
    /** Poids de tirage des biomes pour les graines de génération. */
    biomeWeights: [
      [BIOMES.FORET, 1],
      [BIOMES.JUNGLE, 1],
      [BIOMES.PLAINE, 1],
      [BIOMES.DESERT, 1],
      [BIOMES.MONTAGNE, 0.7],
    ],
    /** Nombre maximal de tentatives de génération avant abandon. */
    maxGenerationAttempts: 200,
  },

  energy: { perTurn: 4, max: 10, start: 0 },
  hand: { max: 4 },
  deck: { size: 6 },
  turn: { seconds: 20 },

  /** PV regagnés en fin de manche si la créature n'a ni frappé ni été touchée. */
  regen: 1,

  /** Mort subite : à partir de la manche 30, -1 PV/phase, +1 toutes les 10 manches. */
  suddenDeath: { startRound: 30, damage: 1, step: 10 },

  /** Rayon de recherche d'une case de repli lors de Poussée Volcanique. */
  volcanicPushRadius: 2,

  creatures: {
    [INSTINCTS.FUYARD]: { cost: 1, hp: 6, atk: 0, speed: 2, vision: 3 },
    [INSTINCTS.CHAROGNARD]: { cost: 2, hp: 8, atk: 2, speed: 2, vision: 4 },
    [INSTINCTS.PROTECTEUR]: { cost: 2, hp: 14, atk: 2, speed: 1, vision: 3 },
    // Le territorial voit sa région + son halo ; `vision` n'est pas utilisée.
    [INSTINCTS.TERRITORIAL]: { cost: 3, hp: 16, atk: 4, speed: 1, vision: 0 },
    [INSTINCTS.DOMINANT]: { cost: 3, hp: 12, atk: 5, speed: 1, vision: 4 },
    [INSTINCTS.CHASSEUR]: { cost: 4, hp: 12, atk: 4, speed: 2, vision: 5 },
  },

  /** Planchers de statistiques (§6.6). */
  minima: { atk: 0, speed: 1, vision: 1 },

  /** Durées en manches du lanceur (§6.6). `null` = permanent. */
  durations: {
    obsession: null,
    paniqueCollective: 2,
    hierarchieBrisee: 2,
    frenesie: 2,
    appat: 2,
    luneDeSang: 3,
    carapace: 2,
    brouillardEpais: 2,
    ecailleDePierre: 3,
  },

  effects: {
    frenesie: { atk: 2, speed: 1 },
    luneDeSang: { atk: 1, speed: 1 },
    brouillardEpais: { vision: 1 },
    /** Diviseur de dégâts pour Écaille de Pierre (arrondi au supérieur). */
    ecailleDePierre: { divisor: 2 },
  },
};

export const CARD_CATEGORIES = /** @type {const} */ ({
  INSTINCT: 'instinct',
  BUFF: 'buff',
  TERRAIN: 'terrain',
});

/**
 * Modes de ciblage :
 *   ally | enemy      -> une créature alliée / adverse
 *   enemy+ally        -> deux cibles (la créature asservie, puis sa proie alliée)
 *   global            -> aucune cible
 *   cell              -> une case libre non-montagne
 *   area2x2           -> coin supérieur gauche d'un carré 2x2 entièrement sur la grille
 *   region:<biome>    -> une région de biome donnée
 */
export const CARDS = [
  {
    id: 'retour_instinct_primordial',
    name: "Retour à l'Instinct Primordial",
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'ally',
    text: 'La créature devient Chasseur. PV conservés au prorata.',
  },
  {
    id: 'peur_devorante',
    name: 'Peur Dévorante',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'enemy',
    text: 'La créature devient Fuyard.',
  },
  {
    id: 'terrain_sacre',
    name: 'Terrain Sacré',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'ally',
    text: 'La créature devient Territoriale ; sa zone est la région où elle se trouve.',
  },
  {
    id: 'obsession',
    name: 'Obsession',
    cost: 2,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'enemy+ally',
    text: "La créature traque une créature alliée désignée jusqu'à sa mort, puis retrouve son instinct.",
  },
  {
    id: 'panique_collective',
    name: 'Panique Collective',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'area2x2',
    text: 'Les créatures ennemies du carré 2×2 deviennent Fuyardes pendant 2 tours.',
  },
  {
    id: 'hierarchie_brisee',
    name: 'Hiérarchie Brisée',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'global',
    text: 'Pendant 2 tours, les Dominants adverses attaquent n’importe quelle créature adjacente.',
  },
  {
    id: 'frenesie',
    name: 'Frénésie',
    cost: 2,
    category: CARD_CATEGORIES.BUFF,
    target: 'ally',
    text: '+2 ATK et +1 vitesse pendant 2 tours.',
  },
  {
    id: 'appat',
    name: 'Appât',
    cost: 2,
    category: CARD_CATEGORIES.BUFF,
    target: 'cell',
    text: 'Pendant 2 tours, les créatures ennemies qui voient le leurre s’y dirigent.',
  },
  {
    id: 'lune_de_sang',
    name: 'Lune de Sang',
    cost: 3,
    category: CARD_CATEGORIES.BUFF,
    target: 'global',
    text: 'Pendant 3 tours, les Chasseurs et Dominants alliés gagnent +1 ATK et +1 vitesse.',
  },
  {
    id: 'carapace',
    name: 'Carapace',
    cost: 3,
    category: CARD_CATEGORIES.BUFF,
    target: 'ally',
    text: 'Pendant 2 tours, la créature ne subit aucun dégât mais son ATK tombe à 0.',
  },
  {
    id: 'brouillard_epais',
    name: 'Brouillard Épais',
    cost: 2,
    category: CARD_CATEGORIES.TERRAIN,
    target: 'global',
    text: 'Pendant 2 tours, la vision de toutes les créatures adverses est ramenée à 1.',
  },
  {
    id: 'ecaille_de_pierre',
    name: 'Écaille de Pierre',
    cost: 2,
    category: CARD_CATEGORIES.TERRAIN,
    target: 'global',
    text: 'Pendant 3 tours, les Protecteurs alliés ne subissent que la moitié des dégâts.',
  },
  {
    id: 'feu_de_foret',
    name: 'Feu de Forêt',
    cost: 2,
    category: CARD_CATEGORIES.TERRAIN,
    target: `region:${BIOMES.FORET}`,
    text: 'Toute la région de forêt devient plaine.',
  },
  {
    id: 'secheresse',
    name: 'Sécheresse',
    cost: 2,
    category: CARD_CATEGORIES.TERRAIN,
    target: `region:${BIOMES.PLAINE}`,
    text: 'Toute la région de plaine devient désert.',
  },
  {
    id: 'poussee_volcanique',
    name: 'Poussée Volcanique',
    cost: 3,
    category: CARD_CATEGORIES.TERRAIN,
    target: `region:${BIOMES.DESERT}`,
    text: 'Toute la région de désert devient montagne ; les créatures sont repoussées.',
  },
  {
    id: 'fertilisation',
    name: 'Fertilisation',
    cost: 2,
    category: CARD_CATEGORIES.TERRAIN,
    target: `region:${BIOMES.MONTAGNE}`,
    text: 'Toute la région de montagne devient forêt.',
  },
];

export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Transformations de biome appliquées par les cartes de terrain. */
export const TERRAIN_TRANSFORMS = {
  feu_de_foret: { from: BIOMES.FORET, to: BIOMES.PLAINE },
  secheresse: { from: BIOMES.PLAINE, to: BIOMES.DESERT },
  poussee_volcanique: { from: BIOMES.DESERT, to: BIOMES.MONTAGNE },
  fertilisation: { from: BIOMES.MONTAGNE, to: BIOMES.FORET },
};

export const PLAYERS = /** @type {const} */ ({ A: 0, B: 1 });
