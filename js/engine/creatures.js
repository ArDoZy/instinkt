/**
 * Créatures : création, statistiques effectives, changement d'instinct.
 */

import { BALANCE, BIOME_META, INSTINCTS } from './constants.js';
import { EFFECTS, GLOBALS, getEffect, globalFor, hasEffect } from './effects.js';

export const isKing = (c) => c.instinct === INSTINCTS.ROI;
export const isRegicide = (c) => c.instinct === INSTINCTS.TUEUR_DE_ROI;

/**
 * Le Roi est intouchable par tout ce qui détourne un comportement : aucun
 * changement d'instinct, aucune obsession, aucune panique, aucun leurre. Il
 * n'obéit qu'à sa propre règle — éviter le combat et riposter.
 */
export const isMindControllable = (c) => !isKing(c);

/** Le Roi d'un joueur, ou null s'il est mort. */
export const kingOf = (state, owner) =>
  state.creatures.find((c) => c.hp > 0 && c.owner === owner && isKing(c)) ?? null;

/**
 * Crée une créature et l'ajoute au state. L'identifiant est croissant : il sert
 * d'ordre d'invocation pour tous les départages (§6.2).
 */
export function createCreature(state, { owner, instinct, cell, zone = null }) {
  const base = BALANCE.creatures[instinct];
  const creature = {
    id: state.nextCreatureId++,
    owner,
    instinct,
    cell,
    hp: base.hp,
    maxHp: base.hp,
    /** Zone fixée à l'invocation pour un Territorial (§6.7). */
    zone,
    effects: [],
    /** Instinct d'origine, restauré à la fin d'une Obsession (§6.1). */
    summonRound: state.round,
    /** Allié protégé lors de la phase courante (§6.5). */
    protectingId: null,
    attackedThisPhase: false,
    damagedThisPhase: false,
  };
  state.creatures.push(creature);
  return creature;
}

/** Bonus de vision du biome sur lequel se tient l'observateur (§2). */
export const biomeVisionMod = (state, creature) =>
  BIOME_META[state.board.tiles[creature.cell]].visionMod;

/**
 * Statistiques effectives, tous effets cumulés (§6.6) :
 * les effets différents s'additionnent, Carapace prime sur tout ce qui touche
 * l'ATK, et les planchers s'appliquent en dernier.
 */
export function stats(state, creature) {
  const base = BALANCE.creatures[creature.instinct];
  let atk = base.atk;
  let speed = base.speed;
  let vision = base.vision + biomeVisionMod(state, creature);

  if (hasEffect(creature, EFFECTS.FRENESIE)) {
    atk += BALANCE.effects.frenesie.atk;
    speed += BALANCE.effects.frenesie.speed;
  }

  const luneDeSang = globalFor(state, GLOBALS.LUNE_DE_SANG, creature);
  const beneficieDeLaLune =
    creature.instinct === INSTINCTS.CHASSEUR || creature.instinct === INSTINCTS.TUEUR_DE_ROI;
  if (luneDeSang && beneficieDeLaLune) {
    atk += BALANCE.effects.luneDeSang.atk;
    speed += BALANCE.effects.luneDeSang.speed;
  }

  // Carapace : immunité totale, mais ATK à 0 quels que soient les buffs (§6.6).
  if (hasEffect(creature, EFFECTS.CARAPACE)) atk = 0;

  // Brouillard Épais : la vision est *ramenée* à 1, pas modifiée.
  if (globalFor(state, GLOBALS.BROUILLARD, creature)) vision = 1;

  return {
    atk: Math.max(BALANCE.minima.atk, atk),
    speed: Math.max(BALANCE.minima.speed, speed),
    vision: Math.max(BALANCE.minima.vision, vision),
  };
}

/** Une créature est-elle sous la moitié de ses PV max ? (marqueur visible) */
export const isWounded = (c) => c.hp < c.maxHp / 2;

/**
 * Change l'instinct d'une créature. Les effets temporaires sont conservés et
 * les PV reportés au prorata, minimum 1 (§6.6).
 *
 * @param {object} opts
 *   `zone`      — zone du Territorial, obligatoire pour ce seul instinct.
 *   `permanent` — un changement permanent annule une Panique en cours (§6.6).
 */
export function changeInstinct(state, creature, instinct, { zone = null, permanent = true } = {}) {
  const before = creature.instinct;
  if (permanent) {
    // La créature ne reviendra pas à son ancien instinct.
    const panique = getEffect(creature, EFFECTS.PANIQUE);
    if (panique) creature.effects = creature.effects.filter((e) => e !== panique);
    const obsession = getEffect(creature, EFFECTS.OBSESSION);
    if (obsession) obsession.previousInstinct = instinct;
  }

  const nextMax = BALANCE.creatures[instinct].hp;
  creature.hp = Math.max(1, Math.round((nextMax * creature.hp) / creature.maxHp));
  creature.maxHp = nextMax;
  creature.instinct = instinct;
  creature.zone = instinct === INSTINCTS.TERRITORIAL ? zone : null;
  creature.protectingId = null;
  return { before, after: instinct };
}
