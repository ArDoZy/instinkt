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
  /** Posé au début de la partie, jamais invoqué : c'est l'enjeu. */
  ROI: 'roi',
  PROTECTEUR: 'protecteur',
  TERRITORIAL: 'territorial',
  CHASSEUR: 'chasseur',
  TUEUR_DE_ROI: 'tueurDeRoi',
  /** Non invocable : état de panique infligé par carte (Peur Dévorante). */
  FUYARD: 'fuyard',
});

export const INSTINCT_LIST = [
  INSTINCTS.ROI,
  INSTINCTS.PROTECTEUR,
  INSTINCTS.TERRITORIAL,
  INSTINCTS.CHASSEUR,
  INSTINCTS.TUEUR_DE_ROI,
  INSTINCTS.FUYARD,
];

/** Noms lisibles, partagés par le journal du moteur et l'interface. */
export const INSTINCT_LABEL = {
  [INSTINCTS.ROI]: 'Roi',
  [INSTINCTS.PROTECTEUR]: 'Protecteur',
  [INSTINCTS.TERRITORIAL]: 'Territorial',
  [INSTINCTS.CHASSEUR]: 'Chasseur',
  [INSTINCTS.TUEUR_DE_ROI]: 'Tueur de Roi',
  [INSTINCTS.FUYARD]: 'Paniquée',
};

/** Ce qu'un joueur peut invoquer : ni le Roi, ni l'état de panique. */
export const SUMMONABLE_INSTINCTS = [
  INSTINCTS.PROTECTEUR,
  INSTINCTS.TERRITORIAL,
  INSTINCTS.CHASSEUR,
  INSTINCTS.TUEUR_DE_ROI,
];

export const BALANCE = {
  board: {
    width: 16,
    height: 16,
    /** Cases libres (non-montagne) minimum par moitié de plateau. */
    minFreeCellsPerHalf: 40,
    /**
     * Le nombre de régions suit la taille du plateau : les taches de biome
     * gardent le même calibre qu'en 8×8 (une dizaine de cases), il y en a
     * simplement quatre fois plus.
     */
    minRegions: 14,
    maxRegions: 30,
    /** Part maximale de montagne sur le plateau : au-delà, la partie s'étrique. */
    maxMountainRatio: 0.22,
    /** Part maximale d'une seule région : évite les plateaux monochromes. */
    maxRegionRatio: 0.14,
    /** Nombre de biomes distincts exigés : un plateau doit offrir des choix. */
    minDistinctBiomes: 4,
    minSeeds: 26,
    maxSeeds: 38,
    /** Poids de tirage des biomes pour les graines de génération. */
    biomeWeights: [
      [BIOMES.FORET, 1],
      [BIOMES.JUNGLE, 1],
      [BIOMES.PLAINE, 1],
      [BIOMES.DESERT, 1],
      [BIOMES.MONTAGNE, 0.7],
    ],
    /** Nombre maximal de tentatives de génération avant abandon. */
    maxGenerationAttempts: 400,
  },

  energy: {
    perTurn: 4,
    max: 10,
    start: 0,
    /**
     * Compensation, façon komi : dans une course au régicide, ouvrir est un
     * avantage de tempo. Le joueur qui ouvre touche donc une première rente
     * réduite de ce montant — c'est un demi-tour de retard sur sa première
     * invocation, pas une punition durable.
     */
    openingPenalty: 2,
  },
  hand: { max: 4 },
  deck: { size: 6 },
  turn: { seconds: 30 },

  /**
   * PV regagnés en fin de manche si la créature n'a ni frappé ni été touchée.
   * Le Roi en est exclu : un point de vie qu'il perd l'est pour toujours.
   */
  regen: 1,

  /** Mort subite : à partir de la manche 30, -1 PV/phase, +1 toutes les 10 manches. */
  /**
   * Mort subite : filet de sécurité, pas moteur de la partie. Une traque
   * décidée aboutit en une vingtaine de manches ; le seuil est posé au-delà
   * pour que ce soit le régicide qui conclue, et la mort subite seulement les
   * parties qui s'enlisent.
   */
  suddenDeath: { startRound: 40, damage: 1, step: 10 },

  /** Rayon de recherche d'une case de repli lors de Poussée Volcanique. */
  volcanicPushRadius: 2,

  /**
   * Stats des créatures. Le coût reflète la capacité à *engager* le combat,
   * pas la puissance brute : un instinct qui refuse d'attaquer la plupart des
   * cibles (dominant, charognard) est bon marché ; un instinct qui fonce
   * toujours (chasseur) est cher. Voir tools/balance.mjs.
   */
  creatures: {
    // Le Roi n'est pas invocable : chaque joueur pose le sien avant la partie.
    [INSTINCTS.ROI]: { cost: 0, hp: 55, atk: 8, speed: 1, vision: 4 },
    [INSTINCTS.PROTECTEUR]: { cost: 2, hp: 14, atk: 2, speed: 1, vision: 3 },
    // Le territorial voit sa région + son halo ; `vision` n'est pas utilisée.
    [INSTINCTS.TERRITORIAL]: { cost: 2, hp: 13, atk: 3, speed: 1, vision: 0 },
    [INSTINCTS.CHASSEUR]: { cost: 3, hp: 11, atk: 4, speed: 2, vision: 5 },
    // Le tueur de Roi sait toujours où est le Roi adverse ; sa vision ne sert
    // qu'à percevoir ce qui l'entoure.
    [INSTINCTS.TUEUR_DE_ROI]: { cost: 2, hp: 8, atk: 6, speed: 2, vision: 3 },
    // État de panique, jamais invoqué.
    [INSTINCTS.FUYARD]: { cost: 1, hp: 6, atk: 0, speed: 2, vision: 3 },
  },

  /** Planchers de statistiques (§6.6). */
  minima: { atk: 0, speed: 1, vision: 1 },

  /** Durées en manches du lanceur (§6.6). `null` = permanent. */
  durations: {
    obsession: null,
    paniqueCollective: 2,
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
    /** Détourne un comportement : sans effet sur un Roi. */
    mindControl: true,
    name: "Retour à l'Instinct Primordial",
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'ally',
    text: 'La créature devient Chasseur, PV au prorata.',
  },
  {
    id: 'peur_devorante',
    /** Détourne un comportement : sans effet sur un Roi. */
    mindControl: true,
    name: 'Peur Dévorante',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'enemy',
    text: 'La créature panique : elle fuit et n’attaque plus.',
  },
  {
    id: 'terrain_sacre',
    /** Détourne un comportement : sans effet sur un Roi. */
    mindControl: true,
    name: 'Terrain Sacré',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'ally',
    text: 'La créature devient Territoriale sur sa région.',
  },
  {
    id: 'obsession',
    /** Détourne un comportement : sans effet sur un Roi. */
    mindControl: true,
    name: 'Obsession',
    cost: 2,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'enemy+ally',
    text: "Traque une créature alliée désignée jusqu'à sa mort.",
  },
  {
    id: 'panique_collective',
    /** Détourne un comportement : sans effet sur un Roi. */
    mindControl: true,
    name: 'Panique Collective',
    cost: 3,
    category: CARD_CATEGORIES.INSTINCT,
    target: 'area2x2',
    text: 'Les ennemis du carré 2×2 paniquent pendant 2 tours.',
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
    text: 'Pendant 2 tours, les ennemis qui voient le leurre s’y dirigent.',
  },
  {
    id: 'lune_de_sang',
    name: 'Lune de Sang',
    cost: 3,
    category: CARD_CATEGORIES.BUFF,
    target: 'global',
    text: 'Pendant 3 tours, Chasseurs et Tueurs de Roi alliés : +1 ATK, +1 vitesse.',
  },
  {
    id: 'carapace',
    name: 'Carapace',
    cost: 3,
    category: CARD_CATEGORIES.BUFF,
    target: 'ally',
    text: 'Pendant 2 tours : aucun dégât subi, mais ATK à 0.',
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
    text: 'Pendant 3 tours, les Protecteurs alliés encaissent moitié moins.',
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
    text: 'La région de désert devient montagne ; les créatures sont repoussées.',
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
