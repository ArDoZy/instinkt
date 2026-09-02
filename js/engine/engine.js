/**
 * Moteur : `applyAction(state, action) -> newState`.
 *
 * Pur et déterministe : le state d'entrée n'est jamais modifié, et un même
 * couple (state, action) produit toujours le même résultat. Toute la résolution
 * empile des événements dans `newState.events`, que la vue rejoue en animations
 * sans jamais recalculer de logique.
 */

import { BALANCE, CARDS_BY_ID, INSTINCTS, INSTINCT_LABEL, SUMMONABLE_INSTINCTS } from './constants.js';
import { EFFECTS, tickCreatureEffects, tickGlobalEffects } from './effects.js';
import { changeInstinct, createCreature } from './creatures.js';
import { applyCard, isLegalTarget, legalTargets } from './cards.js';
import {
  checkGameOver,
  resolveCombat,
  resolveDeaths,
  resolveMovement,
  resolveRegen,
  resolveSuddenDeath,
} from './resolution.js';
import { PHASES, cloneState, isCellFree, livingCreatures, logLine, pushEvent, regionOf, summonableCells } from './state.js';
import { halfOfCell } from './geometry.js';

export const ACTIONS = /** @type {const} */ ({
  PLACE_STARTER: 'placeStarter',
  SUMMON: 'summon',
  PLAY_CARD: 'playCard',
  DISCARD: 'discard',
  END_TURN: 'endTurn',
});

/** Erreur d'action illégale — le moteur refuse plutôt que de deviner. */
export class IllegalAction extends Error {}

/**
 * Applique une action et renvoie un nouveau state.
 * @throws {IllegalAction} si l'action n'est pas légale dans ce state.
 */
export function applyAction(state, action) {
  const next = cloneState(state);
  next.events = [];

  if (next.winner !== null) throw new IllegalAction('La partie est terminée.');

  switch (action.type) {
    case ACTIONS.PLACE_STARTER:
      placeStarter(next, action);
      break;
    case ACTIONS.SUMMON:
      summon(next, action);
      break;
    case ACTIONS.PLAY_CARD:
      playCard(next, action);
      break;
    case ACTIONS.DISCARD:
      discard(next, action);
      break;
    case ACTIONS.END_TURN:
      endTurn(next, action);
      break;
    default:
      throw new IllegalAction(`Action inconnue : ${action.type}`);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Placement initial
// ---------------------------------------------------------------------------

/** Joueur à qui c'est de placer son Roi. */
export function playerToPlace(state) {
  if (state.phase !== PHASES.PLACEMENT) return null;
  const placed = new Set(state.creatures.map((c) => c.owner));
  if (!placed.has(state.firstPlacer)) return state.firstPlacer;
  if (!placed.has(1 - state.firstPlacer)) return 1 - state.firstPlacer;
  return null;
}

function placeStarter(state, { player, cell }) {
  if (state.phase !== PHASES.PLACEMENT) throw new IllegalAction('Hors phase de placement.');
  if (player !== playerToPlace(state)) throw new IllegalAction("Ce n'est pas à ce joueur de placer.");
  if (halfOfCell(cell) !== player || !isCellFree(state, cell)) {
    throw new IllegalAction('Case de placement invalide.');
  }

  const creature = createCreature(state, { owner: player, instinct: INSTINCTS.ROI, cell });
  pushEvent(state, 'summon', { id: creature.id, owner: player, instinct: creature.instinct, cell });
  logLine(state, `Joueur ${player + 1} place son Roi.`);

  if (playerToPlace(state) === null) {
    state.phase = PHASES.ACTIONS;
    // Le joueur qui n'a pas placé en premier joue la première manche (§4).
    state.activePlayer = 1 - state.firstPlacer;
    beginTurn(state);
  }
}

// ---------------------------------------------------------------------------
// Phase d'actions
// ---------------------------------------------------------------------------

function requireActionPhase(state, player) {
  if (state.phase !== PHASES.ACTIONS) throw new IllegalAction('Hors phase d’actions.');
  if (player !== state.activePlayer) throw new IllegalAction("Ce n'est pas le tour de ce joueur.");
  if (state.pendingDiscard !== null && state.pendingDiscard !== undefined) {
    throw new IllegalAction('Il faut d’abord défausser une carte.');
  }
}

/** Instincts encore invocables ce tour, avec leur coût et leur disponibilité. */
export function summonOptions(state, player) {
  const energy = state.players[player].energy;
  const cells = summonableCells(state, player);
  return SUMMONABLE_INSTINCTS.map((instinct) => ({
    instinct,
    cost: BALANCE.creatures[instinct].cost,
    affordable: BALANCE.creatures[instinct].cost <= energy,
    alreadySummoned: state.summonedInstinctsThisTurn.includes(instinct),
    hasRoom: cells.length > 0,
    get legal() {
      return this.affordable && !this.alreadySummoned && this.hasRoom;
    },
  }));
}

function summon(state, { player, instinct, cell }) {
  requireActionPhase(state, player);
  const base = BALANCE.creatures[instinct];
  if (!base || !SUMMONABLE_INSTINCTS.includes(instinct)) {
    throw new IllegalAction(`Instinct non invocable : ${instinct}`);
  }
  if (state.summonedInstinctsThisTurn.includes(instinct)) {
    throw new IllegalAction('Un seul exemplaire de cet instinct par tour.');
  }
  if (state.players[player].energy < base.cost) throw new IllegalAction('Énergie insuffisante.');
  if (halfOfCell(cell) !== player || !isCellFree(state, cell)) {
    throw new IllegalAction('Invocation hors de sa moitié ou sur une case occupée.');
  }

  state.players[player].energy -= base.cost;
  state.summonedInstinctsThisTurn.push(instinct);
  const zone = instinct === INSTINCTS.TERRITORIAL ? regionOf(state, cell).cells.slice() : null;
  const creature = createCreature(state, { owner: player, instinct, cell, zone });

  pushEvent(state, 'energy', { player, energy: state.players[player].energy, delta: -base.cost });
  pushEvent(state, 'summon', { id: creature.id, owner: player, instinct, cell });
  logLine(state, `Joueur ${player + 1} invoque un ${INSTINCT_LABEL[instinct]} (−${base.cost}⚡).`);
}

/** Cartes jouables : en main, payables, et disposant d'au moins une cible (§6.9). */
export function playableCards(state, player) {
  return state.players[player].hand.map((cardId) => {
    const card = CARDS_BY_ID[cardId];
    const targets = legalTargets(state, player, cardId);
    return {
      cardId,
      card,
      targets,
      affordable: card.cost <= state.players[player].energy,
      legal: card.cost <= state.players[player].energy && targets.length > 0,
    };
  });
}

function playCard(state, { player, cardId, target = {} }) {
  requireActionPhase(state, player);
  const hand = state.players[player].hand;
  const index = hand.indexOf(cardId);
  if (index === -1) throw new IllegalAction("Cette carte n'est pas en main.");

  const card = CARDS_BY_ID[cardId];
  if (state.players[player].energy < card.cost) throw new IllegalAction('Énergie insuffisante.');
  if (!isLegalTarget(state, player, cardId, target)) throw new IllegalAction('Cible illégale.');

  state.players[player].energy -= card.cost;
  hand.splice(index, 1);
  // Une carte jouée retourne en bas de la pioche : le deck est cyclique (§5).
  state.players[player].draw.push(cardId);

  pushEvent(state, 'energy', { player, energy: state.players[player].energy, delta: -card.cost });
  pushEvent(state, 'playCard', { player, cardId, target });
  applyCard(state, player, cardId, target);
  logLine(state, `Joueur ${player + 1} joue ${card.name} (−${card.cost}⚡).`);
}

function discard(state, { player, cardId }) {
  if (state.pendingDiscard !== player) throw new IllegalAction('Aucune défausse en attente.');
  const hand = state.players[player].hand;
  const index = hand.indexOf(cardId);
  if (index === -1) throw new IllegalAction("Cette carte n'est pas en main.");

  hand.splice(index, 1);
  // La défausse repart en bas de la pioche (§3.2).
  state.players[player].draw.push(cardId);
  state.pendingDiscard = null;
  pushEvent(state, 'discard', { player, cardId });
  logLine(state, `Joueur ${player + 1} défausse ${CARDS_BY_ID[cardId].name}.`);
}

// ---------------------------------------------------------------------------
// Manche
// ---------------------------------------------------------------------------

/** Début de manche : gain d'énergie plafonné, puis pioche (§3.1 et §3.2). */
function beginTurn(state) {
  const player = state.players[state.activePlayer];
  state.round += 1;
  state.summonedInstinctsThisTurn = [];
  state.pendingDiscard = null;

  const before = player.energy;
  // Ouvrir la partie est un avantage de tempo : la première rente du joueur
  // qui ouvre est réduite d'autant.
  const rente =
    state.round === 1 ? BALANCE.energy.perTurn - BALANCE.energy.openingPenalty : BALANCE.energy.perTurn;
  player.energy = Math.min(BALANCE.energy.max, player.energy + rente);
  pushEvent(state, 'energy', { player: player.id, energy: player.energy, delta: player.energy - before });

  if (player.draw.length) {
    const cardId = player.draw.shift();
    player.hand.push(cardId);
    pushEvent(state, 'draw', { player: player.id, cardId });
    // Main déjà pleine : le joueur pioche puis défausse une carte de son choix (§3.2).
    if (player.hand.length > BALANCE.hand.max) state.pendingDiscard = player.id;
  }

  pushEvent(state, 'turnStart', { player: player.id, round: state.round });
  logLine(state, `— Manche ${state.round} : joueur ${player.id + 1}`);
}

/**
 * Fin de manche : mouvement, combat, régénération, décompte des durées, puis
 * passage au joueur suivant (§3.4 à §3.7).
 */
function endTurn(state, { player }) {
  if (state.phase !== PHASES.ACTIONS) throw new IllegalAction('Hors phase d’actions.');
  if (player !== state.activePlayer) throw new IllegalAction("Ce n'est pas le tour de ce joueur.");
  if (state.pendingDiscard === player) throw new IllegalAction('Il faut d’abord défausser une carte.');

  pushEvent(state, 'phase', { name: 'movement' });
  const plans = resolveMovement(state);

  pushEvent(state, 'phase', { name: 'combat' });
  resolveCombat(state, plans);
  resolveSuddenDeath(state);
  resolveDeaths(state);

  if (checkGameOver(state) !== null) {
    state.phase = PHASES.GAME_OVER;
    state.lastTurnEvents = state.events.slice();
    return;
  }

  resolveRegen(state);
  tickDurations(state, player);

  state.lastTurnEvents = state.events.slice();
  pushEvent(state, 'turnEnd', { player });

  state.activePlayer = 1 - player;
  beginTurn(state);
}

/**
 * Les compteurs de durée se décrémentent à la fin de la manche du joueur qui a
 * lancé l'effet (§6.6).
 */
function tickDurations(state, player) {
  for (const creature of livingCreatures(state)) {
    for (const expired of tickCreatureEffects(creature, player)) {
      if (expired.kind !== EFFECTS.PANIQUE) continue;
      // Panique restitue l'instinct mémorisé au moment de son application.
      const change = changeInstinct(state, creature, expired.previousInstinct, {
        zone: expired.previousZone,
        permanent: false,
      });
      pushEvent(state, 'instinctChange', {
        id: creature.id,
        from: change.before,
        to: change.after,
        cause: 'paniqueEnded',
      });
    }
  }

  for (const expired of tickGlobalEffects(state, player)) {
    pushEvent(state, 'globalEnded', { kind: expired.kind, caster: expired.caster });
  }

  const lure = state.players[player].lure;
  if (lure) {
    lure.remaining -= 1;
    if (lure.remaining <= 0) {
      state.players[player].lure = null;
      pushEvent(state, 'lureEnded', { player });
    }
  }
}

// ---------------------------------------------------------------------------
// Lecture pour la vue et une IA future
// ---------------------------------------------------------------------------

/** Toutes les actions légales du joueur actif. Sert à l'UI et à une IA. */
export function legalActions(state) {
  if (state.winner !== null) return [];

  if (state.phase === PHASES.PLACEMENT) {
    const player = playerToPlace(state);
    if (player === null) return [];
    return summonableCells(state, player).map((cell) => ({ type: ACTIONS.PLACE_STARTER, player, cell }));
  }

  const player = state.activePlayer;
  if (state.pendingDiscard === player) {
    return state.players[player].hand.map((cardId) => ({ type: ACTIONS.DISCARD, player, cardId }));
  }

  const actions = [{ type: ACTIONS.END_TURN, player }];
  for (const option of summonOptions(state, player)) {
    if (!option.legal) continue;
    for (const cell of summonableCells(state, player)) {
      actions.push({ type: ACTIONS.SUMMON, player, instinct: option.instinct, cell });
    }
  }
  for (const entry of playableCards(state, player)) {
    if (!entry.legal) continue;
    for (const target of entry.targets) {
      actions.push({ type: ACTIONS.PLAY_CARD, player, cardId: entry.cardId, target });
    }
  }
  return actions;
}
