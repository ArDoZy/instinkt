/**
 * Helpers de grille. Une case est identifiée par son index `i = y * width + x`.
 * Toutes les distances du jeu sont des distances de Chebyshev (§4).
 */

import { BALANCE } from './constants.js';

export const W = BALANCE.board.width;
export const H = BALANCE.board.height;

export const idx = (x, y) => y * W + x;
export const xOf = (i) => i % W;
export const yOf = (i) => (i / W) | 0;
export const xyOf = (i) => ({ x: i % W, y: (i / W) | 0 });
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

/** Distance de Chebyshev entre deux index. */
export function dist(a, b) {
  return Math.max(Math.abs(xOf(a) - xOf(b)), Math.abs(yOf(a) - yOf(b)));
}

/** Vrai si les deux cases sont à portée d'attaque (Chebyshev 1). */
export const adjacent = (a, b) => a !== b && dist(a, b) === 1;

const DIRS4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const DIRS8 = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

function neighborsFrom(dirs, i) {
  const x = xOf(i);
  const y = yOf(i);
  const out = [];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny)) out.push(idx(nx, ny));
  }
  return out;
}

/** Voisins orthogonaux — sert à la contiguïté des régions de biome (§2). */
export const neighbors4 = (i) => neighborsFrom(DIRS4, i);
/** Voisins en 8 directions — sert au mouvement, à l'attaque et aux halos. */
export const neighbors8 = (i) => neighborsFrom(DIRS8, i);

/** Moitié de plateau : 0 = joueur A (haut), 1 = joueur B (bas). */
export const halfOfCell = (i) => (yOf(i) < H / 2 ? 0 : 1);

/** Toutes les cases du plateau, dans l'ordre d'index. */
export const ALL_CELLS = Array.from({ length: W * H }, (_, i) => i);

/** Formatte une case pour les logs : "c3". */
export function cellName(i) {
  return `${String.fromCharCode(97 + xOf(i))}${yOf(i)}`;
}
