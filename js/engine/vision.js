/**
 * Vision — portée de perception d'une créature.
 *
 * La vision est un rayon de Chebyshev, calculé depuis la case de l'observateur :
 * le biome de la cible n'a aucun effet (§2). Il n'y a pas de ligne de vue :
 * seul le biome sous l'observateur modifie la portée.
 */

import { INSTINCTS } from './constants.js';
import { GLOBALS, globalFor } from './effects.js';
import { stats } from './creatures.js';
import { ALL_CELLS, dist, neighbors8 } from './geometry.js';

/** Cases perçues par un Territorial : sa zone plus le halo qui la borde (§4). */
export function territorialSight(creature) {
  const zone = new Set(creature.zone ?? []);
  const seen = new Set(zone);
  for (const cell of zone) for (const n of neighbors8(cell)) seen.add(n);
  return seen;
}

/**
 * Ensemble des cases perçues.
 * Le Territorial voit sa zone et son halo, quel que soit le biome ; sous
 * Brouillard Épais, cette perception est réduite à ce qui le touche.
 */
export function visibleCells(state, creature) {
  if (creature.instinct === INSTINCTS.TERRITORIAL && creature.zone) {
    const sight = territorialSight(creature);
    if (globalFor(state, GLOBALS.BROUILLARD, creature)) {
      return new Set([...sight].filter((c) => dist(c, creature.cell) <= 1));
    }
    return sight;
  }
  const radius = stats(state, creature).vision;
  return new Set(ALL_CELLS.filter((c) => dist(c, creature.cell) <= radius));
}

export function canSee(state, creature, cell) {
  return visibleCells(state, creature).has(cell);
}

/** Créatures vivantes perçues, hors l'observateur lui-même. */
export function visibleCreatures(state, creature, filter = () => true) {
  const seen = visibleCells(state, creature);
  return state.creatures.filter(
    (other) => other.hp > 0 && other.id !== creature.id && seen.has(other.cell) && filter(other)
  );
}

export const visibleEnemies = (state, creature, filter = () => true) =>
  visibleCreatures(state, creature, (o) => o.owner !== creature.owner && filter(o));

export const visibleAllies = (state, creature, filter = () => true) =>
  visibleCreatures(state, creature, (o) => o.owner === creature.owner && filter(o));
