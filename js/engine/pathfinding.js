/**
 * Déplacement : plus court chemin en 8 directions sur les cases libres.
 *
 * Les montagnes et les créatures bloquent ; le leurre et les cases vides non
 * (§6.3). Le chemin est recalculé à chaque phase, jamais mémorisé.
 *
 * Le parcours est un Dijkstra à coût unitaire (donc un A* dont l'heuristique
 * vaut 0) : sur 64 cases le gain d'une heuristique est nul, et le parcours
 * uniforme donne la distance vers *toutes* les cases d'arrivée à la fois — ce
 * dont le Protecteur a besoin pour choisir, parmi les cases également proches,
 * celle qui s'interpose le mieux. Tous les départages se font sur l'index de
 * case croissant : deux appels identiques renvoient le même chemin.
 */

import { neighbors8 } from './geometry.js';
import { isPassableCell } from './board.js';

/**
 * Cases bloquées au début de la phase : montagnes et créatures vivantes.
 * `ignoreId` exclut la créature qui se déplace.
 */
export function blockedCells(state, ignoreId = null) {
  const blocked = new Set();
  for (let i = 0; i < state.board.tiles.length; i++) {
    if (!isPassableCell(state.board, i)) blocked.add(i);
  }
  for (const c of state.creatures) {
    if (c.hp > 0 && c.id !== ignoreId) blocked.add(c.cell);
  }
  return blocked;
}

/**
 * Parcours en largeur depuis `from` sur les cases libres.
 * @returns {{ dist: Map<number,number>, cameFrom: Map<number,number> }}
 */
export function explore(state, from, blocked, maxSteps = Infinity) {
  const dist = new Map([[from, 0]]);
  const cameFrom = new Map();
  let frontier = [from];
  for (let step = 1; step <= maxSteps && frontier.length; step++) {
    const next = [];
    for (const cell of frontier) {
      for (const n of neighbors8(cell)) {
        if (blocked.has(n) || dist.has(n)) continue;
        dist.set(n, step);
        cameFrom.set(n, cell);
        next.push(n);
      }
    }
    frontier = next.sort((a, b) => a - b);
  }
  return { dist, cameFrom };
}

function rebuild(cameFrom, from, goal) {
  const path = [];
  let cell = goal;
  while (cell !== from) {
    path.push(cell);
    cell = cameFrom.get(cell);
  }
  return path.reverse();
}

/**
 * Chemin le plus court vers la meilleure des cases `goals`.
 *
 * @param {(cell:number) => number} [rank] départage entre cases d'arrivée
 *   également distantes — score le plus faible d'abord.
 * @returns {number[]|null} la suite de cases à parcourir (sans `from`), ou null
 *   si aucune case d'arrivée n'est atteignable.
 */
export function findPath(state, from, goals, blocked, rank = null) {
  if (goals.length === 0) return null;
  if (goals.includes(from)) return [];

  const { dist, cameFrom } = explore(state, from, blocked);
  const reachable = goals.filter((g) => dist.has(g));
  if (reachable.length === 0) return null;

  reachable.sort((a, b) => {
    const d = dist.get(a) - dist.get(b);
    if (d !== 0) return d;
    if (rank) {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
    }
    return a - b;
  });
  return rebuild(cameFrom, from, reachable[0]);
}

/**
 * Cases atteignables en au plus `steps` pas. Sert au Fuyard, qui ne suit pas de
 * chemin vers une cible mais choisit une case de repli.
 * @returns {Map<number, number>} case -> nombre de pas
 */
export function reachableCells(state, from, steps, blocked) {
  return explore(state, from, blocked, steps).dist;
}
