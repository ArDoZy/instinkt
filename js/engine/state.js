/**
 * Structure du state et helpers de lecture.
 *
 * Le state est un objet JSON pur : pas de classes, pas de fonctions, pas de
 * références circulaires. `applyAction(state, action)` (voir engine.js) le
 * clone avant de le modifier, ce qui garde le moteur pur vu de l'extérieur.
 */

import { BALANCE } from './constants.js';
import { createRng, randomSeed, rngInt, rngShuffle } from './prng.js';
import { generateBoard, computeRegions, isPassableCell } from './board.js';
import { ALL_CELLS, halfOfCell } from './geometry.js';

export const STATE_VERSION = 1;

export const PHASES = /** @type {const} */ ({
  DECKBUILD: 'deckbuild',
  PLACEMENT: 'placement',
  ACTIONS: 'actions',
  RESOLUTION: 'resolution',
  GAME_OVER: 'gameOver',
});

/**
 * Crée une partie neuve.
 *
 * @param {{ seed?:number, decks?:string[][], names?:string[] }} options
 *   `decks[i]` = liste de 6 identifiants de cartes pour le joueur i.
 */
export function createGame(options = {}) {
  const seed = options.seed ?? randomSeed();
  const rng = createRng(seed);
  const { board, attempts } = generateBoard(rng);
  const { regions, regionOfCell } = computeRegions(board);

  // Tirage au sort du Joueur 1 : il place son fuyard en premier, mais c'est le
  // Joueur 2 qui joue la première manche (§4).
  const firstPlacer = rngInt(rng, 2);
  const decks = options.decks ?? [[], []];
  const names = options.names ?? ['Joueur A', 'Joueur B'];

  const players = [0, 1].map((id) => ({
    id,
    name: names[id],
    energy: BALANCE.energy.start,
    /** Liste de deck choisie au deckbuilding (6 cartes, sans doublon). */
    deckList: decks[id].slice(),
    /** Pioche : ordre courant, index 0 = sommet. */
    draw: rngShuffle(rng, decks[id].slice()),
    hand: [],
    /** Case du leurre posé par Appât, ou null. */
    lure: null,
    lureExpiresAtRound: null,
    kills: 0,
  }));

  return {
    version: STATE_VERSION,
    seed,
    rng,
    boardAttempts: attempts,
    board,
    regions,
    regionOfCell,
    creatures: [],
    nextCreatureId: 1,
    players,
    /** Joueur dont c'est la manche. */
    activePlayer: 1 - firstPlacer,
    firstPlacer,
    /** Numéro de manche, 1-based, incrémenté à chaque tour de joueur. */
    round: 0,
    phase: PHASES.PLACEMENT,
    /** Effets globaux en cours : { card, owner, expiresAfterRoundOf, ... }. */
    globalEffects: [],
    /** Cases où un combat a eu lieu lors de la dernière phase (§6.8). */
    lastCombatCells: [],
    /** Instincts déjà invoqués pendant la manche courante (§4). */
    summonedInstinctsThisTurn: [],
    /** Joueur devant défausser après une pioche à main pleine (§3.2). */
    pendingDiscard: null,
    /** Journal lisible : { round, player, text }. */
    log: [],
    /** File d'événements de la dernière action, rejouée par la vue. */
    events: [],
    /** Événements de la dernière résolution — bouton « rejouer le dernier tour ». */
    lastTurnEvents: [],
    winner: null,
    endedReason: null,
  };
}

/** Clone profond du state (JSON pur). */
export function cloneState(state) {
  return typeof structuredClone === 'function'
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
}

/** Sérialisation vers une chaîne JSON. */
export function saveState(state) {
  return JSON.stringify(state);
}

/** Désérialisation depuis une chaîne JSON. */
export function loadState(json) {
  const state = typeof json === 'string' ? JSON.parse(json) : cloneState(json);
  if (state.version !== STATE_VERSION) {
    throw new Error(`loadState: version ${state.version} incompatible (attendu ${STATE_VERSION})`);
  }
  return state;
}

/** Recalcule le cache de régions après un changement de terrain. */
export function refreshRegions(state) {
  const { regions, regionOfCell } = computeRegions(state.board);
  state.regions = regions;
  state.regionOfCell = regionOfCell;
  return state;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export const livingCreatures = (state) => state.creatures.filter((c) => c.hp > 0);

export const creatureById = (state, id) => state.creatures.find((c) => c.id === id) ?? null;

export function creatureAt(state, cell) {
  for (const c of state.creatures) if (c.hp > 0 && c.cell === cell) return c;
  return null;
}

/** Une case est libre si elle est franchissable et inoccupée (§4). */
export function isCellFree(state, cell) {
  return isPassableCell(state.board, cell) && creatureAt(state, cell) === null;
}

/** Moitié de plateau appartenant au joueur : A en haut (0), B en bas (1). */
export const homeHalf = (playerId) => playerId;

/** Cases où le joueur peut invoquer (§4). */
export function summonableCells(state, playerId) {
  return ALL_CELLS.filter(
    (cell) => halfOfCell(cell) === homeHalf(playerId) && isCellFree(state, cell)
  );
}

/** Région (objet) d'une case. */
export const regionOf = (state, cell) => state.regions[state.regionOfCell[cell]];

/** Ajoute une ligne au journal. */
export function logLine(state, text) {
  state.log.push({ round: state.round, player: state.activePlayer, text });
  return state;
}

/** Empile un événement destiné à la couche vue. */
export function pushEvent(state, type, payload = {}) {
  state.events.push({ type, payload });
  return state;
}
