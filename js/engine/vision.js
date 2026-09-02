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
import { H, W, dist, idx, neighbors8, xOf, yOf } from './geometry.js';

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
  // On ne balaie que le carré de vision, pas tout le plateau : sur 16×16 la
  // différence compte, cette fonction étant appelée pour chaque créature.
  const radius = stats(state, creature).vision;
  const cx = xOf(creature.cell);
  const cy = yOf(creature.cell);
  const seen = new Set();
  for (let y = Math.max(0, cy - radius); y <= Math.min(H - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(W - 1, cx + radius); x++) {
      seen.add(idx(x, y));
    }
  }
  return seen;
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
