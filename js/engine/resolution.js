/**
 * Résolution d'une phase : mouvement, combat, régénération, mort subite.
 *
 * Règle d'or : toutes les décisions sont calculées sur le state du *début* de
 * la phase, puis appliquées d'un bloc. Aucun effet domino selon l'ordre
 * d'itération (§4).
 */

import { BALANCE, INSTINCTS } from './constants.js';
import { EFFECTS, GLOBALS, getEffect, globalFor, hasEffect } from './effects.js';
import { changeInstinct, isDominantPrey, stats } from './creatures.js';
import { decide, goalCells, goalRank, nearest } from './instincts.js';
import { blockedCells, findPath, reachableCells } from './pathfinding.js';
import { adjacent, dist, neighbors8 } from './geometry.js';
import { creatureById, livingCreatures, pushEvent } from './state.js';

const byId = (a, b) => a.id - b.id;

// ---------------------------------------------------------------------------
// Mouvement
// ---------------------------------------------------------------------------

/**
 * Intention de déplacement d'une créature : sa décision, son chemin et la case
 * où elle compte finir. Calculée sur le state du début de phase.
 */
function planMove(state, creature, blockedFor) {
  const decision = decide(state, creature);
  creature.protectingId = decision && decision.protecting ? decision.targetId : null;

  if (!decision) return { creature, decision, destination: creature.cell, path: [] };

  const speed = stats(state, creature).speed;
  const blocked = blockedFor(creature);

  if (decision.kind === 'flee') return planFlight(state, creature, decision, speed, blocked);

  // Déjà adjacente à sa cible : elle ne bouge plus (§6.3).
  if (decision.kind === 'creature') {
    const prey = creatureById(state, decision.targetId);
    if (prey && adjacent(creature.cell, prey.cell)) {
      return { creature, decision, destination: creature.cell, path: [] };
    }
  }

  const goals = goalCells(state, creature, decision, blocked);
  const path = findPath(state, creature.cell, goals, blocked, goalRank(state, creature, decision));

  if (path && path.length) {
    const walked = path.slice(0, speed);
    return { creature, decision, destination: walked[walked.length - 1], path: walked };
  }
  if (path) return { creature, decision, destination: creature.cell, path: [] };

  // Aucun chemin : on avance vers la case atteignable qui rapproche le plus de
  // la cible ; si aucune n'améliore, on reste immobile (§6.3).
  return planApproach(state, creature, decision, speed, blocked);
}

function targetCellOf(state, decision) {
  if (!decision) return null;
  if (decision.kind === 'cell') return decision.cell;
  const prey = creatureById(state, decision.targetId);
  return prey ? prey.cell : null;
}

function planApproach(state, creature, decision, speed, blocked) {
  const goal = targetCellOf(state, decision);
  if (goal === null) return { creature, decision, destination: creature.cell, path: [] };

  const reachable = reachableCells(state, creature.cell, speed, blocked);
  const zone = creature.instinct === INSTINCTS.TERRITORIAL && creature.zone ? new Set(creature.zone) : null;
  let best = creature.cell;
  let bestDist = dist(creature.cell, goal);
  for (const [cell, steps] of [...reachable].sort((a, b) => a[0] - b[0])) {
    if (zone && !zone.has(cell)) continue;
    const d = dist(cell, goal);
    if (d < bestDist) {
      best = cell;
      bestDist = d;
    }
    void steps;
  }
  return { creature, decision, destination: best, path: best === creature.cell ? [] : [best] };
}

/**
 * Fuite : parmi ses cases accessibles, celle qui maximise la distance à la
 * menace. Acculé, le fuyard reste immobile (§4).
 */
function planFlight(state, creature, decision, speed, blocked) {
  const reachable = reachableCells(state, creature.cell, speed, blocked);
  const current = dist(creature.cell, decision.fromCell);
  let best = creature.cell;
  let bestDist = current;
  let bestSteps = 0;
  for (const [cell, steps] of [...reachable].sort((a, b) => a[0] - b[0])) {
    const d = dist(cell, decision.fromCell);
    if (d > bestDist || (d === bestDist && d > current && steps < bestSteps)) {
      best = cell;
      bestDist = d;
      bestSteps = steps;
    }
  }
  return { creature, decision, destination: best, path: best === creature.cell ? [] : [best] };
}

/**
 * Phase de mouvement : toutes les créatures des deux joueurs se déplacent selon
 * leur instinct (§3.4).
 */
export function resolveMovement(state) {
  const movers = livingCreatures(state).sort(byId);
  const staticBlocked = blockedCells(state);
  const blockedFor = (creature) => {
    const blocked = new Set(staticBlocked);
    blocked.delete(creature.cell);
    return blocked;
  };

  const plans = movers.map((creature) => planMove(state, creature, blockedFor));

  // Conflits : deux créatures visant la même case. Les cases occupées au début
  // de la phase étant bloquées pour tout le monde, une destination n'est jamais
  // la case d'origine d'une autre créature : un seul passage suffit (§4).
  const claims = new Map();
  for (const plan of plans) {
    if (plan.destination === plan.creature.cell) continue;
    const list = claims.get(plan.destination) ?? [];
    list.push(plan);
    claims.set(plan.destination, list);
  }

  for (const [, contenders] of claims) {
    if (contenders.length < 2) continue;
    contenders.sort((a, b) => comparePriority(state, a.creature, b.creature));
    for (const loser of contenders.slice(1)) {
      loser.destination = loser.creature.cell;
      loser.path = [];
      loser.blockedBy = contenders[0].creature.id;
    }
  }

  for (const plan of plans) {
    if (plan.destination === plan.creature.cell) continue;
    const from = plan.creature.cell;
    plan.creature.cell = plan.destination;
    pushEvent(state, 'move', {
      id: plan.creature.id,
      from,
      to: plan.destination,
      path: plan.path,
    });
  }

  return plans;
}

/** Départage des conflits de case : joueur actif, puis vitesse, puis id (§4). */
function comparePriority(state, a, b) {
  if (a.owner !== b.owner) {
    if (a.owner === state.activePlayer) return -1;
    if (b.owner === state.activePlayer) return 1;
  }
  const sa = stats(state, a).speed;
  const sb = stats(state, b).speed;
  if (sa !== sb) return sb - sa;
  return a.id - b.id;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/** Une créature accepte-t-elle de frapper cette voisine ? */
export function isValidPrey(state, attacker, other) {
  if (other.hp <= 0 || other.id === attacker.id) return false;

  const obsession = getEffect(attacker, EFFECTS.OBSESSION);
  // Sous Obsession, elle ne frappe que sa cible, même si un autre ennemi la touche.
  if (obsession) return other.id === obsession.targetId;

  if (attacker.instinct === INSTINCTS.FUYARD) return false;

  if (attacker.instinct === INSTINCTS.DOMINANT) {
    // Hiérarchie Brisée : n'importe quelle voisine, alliée comprise (§5).
    if (globalFor(state, GLOBALS.HIERARCHIE_BRISEE, attacker)) return true;
    return other.owner !== attacker.owner && isDominantPrey(other);
  }

  return other.owner !== attacker.owner;
}

/**
 * Cible d'attaque de chaque créature : sa cible poursuivie si elle est
 * adjacente, sinon n'importe quelle voisine valide (§6.4).
 */
function planAttacks(state, plans) {
  const attacks = [];
  const planOf = new Map(plans.map((p) => [p.creature.id, p]));

  for (const creature of livingCreatures(state).sort(byId)) {
    if (stats(state, creature).atk <= 0) continue;

    const decision = planOf.get(creature.id)?.decision ?? null;
    // Un Territorial qui regagne sa zone ne fait rien d'autre (§6.7).
    if (decision && decision.returning) continue;

    const neighbours = neighbors8(creature.cell)
      .map((cell) => state.creatures.find((c) => c.hp > 0 && c.cell === cell))
      .filter((c) => c && isValidPrey(state, creature, c));

    if (neighbours.length === 0) continue;

    let target = null;
    if (decision && decision.kind === 'creature') {
      target = neighbours.find((c) => c.id === decision.targetId) ?? null;
    }
    if (!target) target = nearest(creature.cell, neighbours);

    attacks.push({ attackerId: creature.id, targetId: target.id, amount: stats(state, creature).atk });
  }

  return refocusProtectors(state, attacks);
}

/**
 * Le protecteur attaque l'agresseur de son protégé s'il lui est adjacent (§4).
 * Ce choix ne peut être fait qu'une fois toutes les attaques connues.
 */
function refocusProtectors(state, attacks) {
  for (const attack of attacks) {
    const protector = creatureById(state, attack.attackerId);
    if (protector.instinct !== INSTINCTS.PROTECTEUR || !protector.protectingId) continue;

    const aggressors = attacks
      .filter((a) => a.targetId === protector.protectingId)
      .map((a) => creatureById(state, a.attackerId))
      .filter((c) => c && c.hp > 0 && adjacent(protector.cell, c.cell) && isValidPrey(state, protector, c));

    const chosen = nearest(protector.cell, aggressors);
    if (chosen) attack.targetId = chosen.id;
  }
  return attacks;
}

/**
 * Protecteur qui absorbe les dégâts destinés à `ward` : il doit lui être
 * adjacent au moment des dégâts. Deux protecteurs sur le même protégé : un seul
 * absorbe, celui du §6.2 (PV les plus bas d'abord).
 */
export function absorberFor(state, ward) {
  const candidates = state.creatures.filter(
    (c) =>
      c.hp > 0 &&
      c.id !== ward.id &&
      c.owner === ward.owner &&
      c.instinct === INSTINCTS.PROTECTEUR &&
      c.protectingId === ward.id &&
      adjacent(c.cell, ward.cell)
  );
  return nearest(ward.cell, candidates);
}

/** Dégâts effectivement subis, après Carapace et Écaille de Pierre. */
function damageTaken(state, creature, amount) {
  if (hasEffect(creature, EFFECTS.CARAPACE)) return 0;
  if (
    creature.instinct === INSTINCTS.PROTECTEUR &&
    globalFor(state, GLOBALS.ECAILLE_DE_PIERRE, creature)
  ) {
    return Math.ceil(amount / BALANCE.effects.ecailleDePierre.divisor);
  }
  return amount;
}

/**
 * Phase de combat : toutes les attaques sont résolues simultanément, les dégâts
 * calculés sur le state d'avant la phase et appliqués d'un bloc (§6.4).
 */
export function resolveCombat(state, plans) {
  for (const creature of state.creatures) {
    creature.attackedThisPhase = false;
    creature.damagedThisPhase = false;
  }

  const attacks = planAttacks(state, plans);
  const combatCells = new Set();
  /** @type {Map<number, number>} créature -> dégâts subis */
  const incoming = new Map();

  for (const attack of attacks) {
    const attacker = creatureById(state, attack.attackerId);
    const target = creatureById(state, attack.targetId);
    attacker.attackedThisPhase = true;
    combatCells.add(attacker.cell);
    combatCells.add(target.cell);

    // L'absorption ne se chaîne pas : les dégâts redirigés s'arrêtent au
    // protecteur (§6.5).
    const absorber = absorberFor(state, target);
    const receiver = absorber ?? target;
    const dealt = damageTaken(state, receiver, attack.amount);

    pushEvent(state, 'attack', {
      id: attacker.id,
      targetId: target.id,
      from: attacker.cell,
      to: target.cell,
      amount: attack.amount,
      absorbedBy: absorber ? absorber.id : null,
      dealt,
    });

    incoming.set(receiver.id, (incoming.get(receiver.id) ?? 0) + dealt);
  }

  for (const [id, amount] of [...incoming].sort((a, b) => a[0] - b[0])) {
    const creature = creatureById(state, id);
    if (amount <= 0) continue;
    creature.hp -= amount;
    creature.damagedThisPhase = true;
    pushEvent(state, 'damage', { id, amount, hp: Math.max(0, creature.hp) });
  }

  state.lastCombatCells = [...combatCells].sort((a, b) => a - b);
  return attacks;
}

// ---------------------------------------------------------------------------
// Après combat
// ---------------------------------------------------------------------------

/**
 * Mort subite : à partir de la manche 30, plus de régénération et toutes les
 * créatures perdent des PV à chaque phase de combat (§6.10).
 */
export function suddenDeathDamage(state) {
  const { startRound, damage, step } = BALANCE.suddenDeath;
  if (state.round < startRound) return 0;
  return damage + Math.floor((state.round - startRound) / step);
}

export function resolveSuddenDeath(state) {
  const amount = suddenDeathDamage(state);
  if (amount <= 0) return;
  for (const creature of livingCreatures(state).sort(byId)) {
    creature.hp -= amount;
    creature.damagedThisPhase = true;
    pushEvent(state, 'suddenDeath', { id: creature.id, amount, hp: Math.max(0, creature.hp) });
  }
}

/** Régénération : +1 PV si la créature n'a ni attaqué ni été touchée (§3.6). */
export function resolveRegen(state) {
  if (suddenDeathDamage(state) > 0) return;
  for (const creature of livingCreatures(state).sort(byId)) {
    if (creature.attackedThisPhase || creature.damagedThisPhase) continue;
    if (creature.hp >= creature.maxHp) continue;
    creature.hp = Math.min(creature.maxHp, creature.hp + BALANCE.regen);
    pushEvent(state, 'regen', { id: creature.id, hp: creature.hp });
  }
}

/**
 * Retire les créatures à 0 PV. Elles meurent toutes ensemble : une créature
 * tuée a déjà porté son coup (§4).
 */
export function resolveDeaths(state) {
  const dead = state.creatures.filter((c) => c.hp <= 0);
  if (dead.length === 0) return dead;

  for (const creature of dead.sort(byId)) {
    state.players[1 - creature.owner].kills += 1;
    pushEvent(state, 'death', { id: creature.id, cell: creature.cell, owner: creature.owner });
  }
  const deadIds = new Set(dead.map((c) => c.id));
  state.creatures = state.creatures.filter((c) => !deadIds.has(c.id));

  // Une Obsession dont la cible meurt rend son instinct à la traqueuse (§6.1).
  for (const creature of state.creatures) {
    const obsession = getEffect(creature, EFFECTS.OBSESSION);
    if (obsession && deadIds.has(obsession.targetId)) {
      creature.effects = creature.effects.filter((e) => e !== obsession);
      const restored = changeInstinct(state, creature, obsession.previousInstinct, {
        zone: obsession.previousZone,
        permanent: false,
      });
      pushEvent(state, 'instinctChange', {
        id: creature.id,
        from: restored.before,
        to: restored.after,
        cause: 'obsessionEnded',
      });
    }
    if (creature.protectingId && deadIds.has(creature.protectingId)) creature.protectingId = null;
  }

  for (const effect of state.globalEffects) {
    effect.creatureIds = effect.creatureIds.filter((id) => !deadIds.has(id));
  }

  return dead;
}

/**
 * Fin de partie : un joueur à 0 créature perd immédiatement ; les deux à 0 lors
 * de la même phase, c'est un match nul (§6.10).
 */
export function checkGameOver(state) {
  const alive = [0, 1].map((p) => state.creatures.filter((c) => c.owner === p && c.hp > 0).length);
  if (alive[0] > 0 && alive[1] > 0) return null;

  const winner = alive[0] === 0 && alive[1] === 0 ? 'draw' : alive[0] === 0 ? 1 : 0;
  state.winner = winner;
  state.endedReason = 'annihilation';
  pushEvent(state, 'gameOver', { winner, reason: 'annihilation' });
  return winner;
}
