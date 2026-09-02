/**
 * Génération du plateau et calcul des régions de biome.
 *
 * Génération par croissance de graines (Voronoï grossier) : quelques graines
 * de biome sont posées au hasard puis grandissent en front aléatoire, ce qui
 * donne des taches contiguës plutôt qu'un bruit poivre-et-sel.
 */

import { BALANCE, BIOMES, BIOME_META } from './constants.js';
import { rngInt, rngRange, rngShuffle, rngWeighted } from './prng.js';
import { ALL_CELLS, H, W, halfOfCell, neighbors4, neighbors8 } from './geometry.js';

/** @typedef {{ width:number, height:number, tiles:string[] }} Board */

export const isPassableBiome = (biome) => BIOME_META[biome].passable;
export const isMountain = (biome) => biome === BIOMES.MONTAGNE;

/** Vrai si la case du plateau est franchissable (pas de montagne). */
export const isPassableCell = (board, i) => isPassableBiome(board.tiles[i]);

/**
 * Régions de biome : groupes de cases contiguës en 4 directions partageant le
 * même biome (§2). Le halo (`fringe`) est en 8 directions pour rester cohérent
 * avec la portée d'attaque et la vision du Territorial.
 *
 * @returns {{ regions: {id:number, biome:string, cells:number[], fringe:number[]}[],
 *             regionOfCell: number[] }}
 */
export function computeRegions(board) {
  const regionOfCell = new Array(W * H).fill(-1);
  const regions = [];

  for (const start of ALL_CELLS) {
    if (regionOfCell[start] !== -1) continue;
    const biome = board.tiles[start];
    const id = regions.length;
    const cells = [];
    const stack = [start];
    regionOfCell[start] = id;
    while (stack.length) {
      const cur = stack.pop();
      cells.push(cur);
      for (const n of neighbors4(cur)) {
        if (regionOfCell[n] === -1 && board.tiles[n] === biome) {
          regionOfCell[n] = id;
          stack.push(n);
        }
      }
    }
    cells.sort((a, b) => a - b);
    const fringeSet = new Set();
    for (const c of cells) {
      // Le remplissage de la région est terminé : tout voisin marqué `id` en fait
      // partie, y compris par contact diagonal.
      for (const n of neighbors8(c)) if (regionOfCell[n] !== id) fringeSet.add(n);
    }
    const fringe = [...fringeSet].sort((a, b) => a - b);
    regions.push({ id, biome, cells, fringe });
  }

  return { regions, regionOfCell };
}

/** Nombre de cases franchissables par moitié de plateau. */
function freeCellsPerHalf(board) {
  const counts = [0, 0];
  for (const i of ALL_CELLS) {
    if (isPassableCell(board, i)) counts[halfOfCell(i)]++;
  }
  return counts;
}

/** Vrai si toutes les cases franchissables forment une seule composante (8 dirs). */
export function isFullyConnected(board) {
  const start = ALL_CELLS.find((i) => isPassableCell(board, i));
  if (start === undefined) return false;
  const seen = new Set([start]);
  const stack = [start];
  let total = 0;
  for (const i of ALL_CELLS) if (isPassableCell(board, i)) total++;
  while (stack.length) {
    const cur = stack.pop();
    for (const n of neighbors8(cur)) {
      if (!seen.has(n) && isPassableCell(board, n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === total;
}

/**
 * Contrôle de validité d'un plateau (§2 « génération valide »).
 * @returns {{ ok:boolean, reason?:string, regionCount:number }}
 */
export function validateBoard(board) {
  const { regions } = computeRegions(board);
  const regionCount = regions.length;
  const { minRegions, maxRegions, minFreeCellsPerHalf, maxMountainRatio, maxRegionRatio, minDistinctBiomes } =
    BALANCE.board;

  if (regionCount < minRegions || regionCount > maxRegions) {
    return { ok: false, reason: `regions=${regionCount}`, regionCount };
  }
  const halves = freeCellsPerHalf(board);
  if (halves[0] < minFreeCellsPerHalf || halves[1] < minFreeCellsPerHalf) {
    return { ok: false, reason: `halves=${halves.join('/')}`, regionCount };
  }
  const biggest = Math.max(...regions.map((r) => r.cells.length));
  if (biggest > maxRegionRatio * board.tiles.length) {
    return { ok: false, reason: `biggestRegion=${biggest}`, regionCount };
  }
  const distinct = new Set(board.tiles).size;
  if (distinct < minDistinctBiomes) {
    return { ok: false, reason: `biomes=${distinct}`, regionCount };
  }
  const mountains = board.tiles.filter(isMountain).length;
  if (mountains > maxMountainRatio * board.tiles.length) {
    return { ok: false, reason: `mountains=${mountains}`, regionCount };
  }
  if (!isFullyConnected(board)) {
    return { ok: false, reason: 'disconnected', regionCount };
  }
  return { ok: true, regionCount };
}

/** Une tentative de génération, sans contrôle de validité. */
function growBoard(rng) {
  const tiles = new Array(W * H).fill(null);
  const seedCount = rngRange(rng, BALANCE.board.minSeeds, BALANCE.board.maxSeeds);

  const cells = rngShuffle(rng, ALL_CELLS.slice());
  const frontier = [];
  for (let s = 0; s < seedCount; s++) {
    const cell = cells[s];
    tiles[cell] = rngWeighted(rng, BALANCE.board.biomeWeights);
    frontier.push(cell);
  }

  // Croissance : on tire une case du front au hasard et on peint un voisin vide.
  let remaining = W * H - seedCount;
  while (remaining > 0 && frontier.length) {
    const pick = rngInt(rng, frontier.length);
    const cur = frontier[pick];
    const empty = neighbors4(cur).filter((n) => tiles[n] === null);
    if (empty.length === 0) {
      frontier.splice(pick, 1);
      continue;
    }
    const next = empty[rngInt(rng, empty.length)];
    tiles[next] = tiles[cur];
    frontier.push(next);
    remaining--;
  }

  // Filet de sécurité : si le front s'épuise (impossible en 4-connexité pleine),
  // on complète avec le biome du voisin le plus proche déjà peint.
  for (const i of ALL_CELLS) {
    if (tiles[i] === null) {
      const painted = neighbors4(i).find((n) => tiles[n] !== null);
      tiles[i] = painted !== undefined ? tiles[painted] : BIOMES.PLAINE;
    }
  }

  return { width: W, height: H, tiles };
}

/**
 * Génère un plateau valide. Rejette et régénère tant que les contraintes du §2
 * ne sont pas satisfaites.
 * @returns {{ board: Board, attempts:number }}
 */
export function generateBoard(rng) {
  const rejets = {};
  for (let attempt = 1; attempt <= BALANCE.board.maxGenerationAttempts; attempt++) {
    const board = growBoard(rng);
    const verdict = validateBoard(board);
    if (verdict.ok) return { board, attempts: attempt, rejets };
    const cle = verdict.reason.split('=')[0];
    rejets[cle] = (rejets[cle] ?? 0) + 1;
  }
  throw new Error('generateBoard: aucun plateau valide après ' + BALANCE.board.maxGenerationAttempts + ' tentatives');
}

/**
 * Applique un changement de biome à un ensemble de cases et renvoie un nouveau
 * plateau (les régions sont recalculées par l'appelant).
 */
export function withBiome(board, cells, biome) {
  const tiles = board.tiles.slice();
  for (const c of cells) tiles[c] = biome;
  return { ...board, tiles };
}
