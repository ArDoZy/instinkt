/** Fabriques de situations de test : plateau plat, créatures posées à la main. */

import { BIOMES, INSTINCTS, PHASES, createGame, createCreature, ALL_CELLS, W, idx } from '../js/engine/index.js';

/** Partie sur plateau entièrement plat (aucun effet de biome sur la vision). */
export function flatGame({ biome = BIOMES.PLAINE, decks = [[], []], seed = 1 } = {}) {
  const state = createGame({ seed, decks });
  state.board = { ...state.board, tiles: new Array(ALL_CELLS.length).fill(biome) };
  state.regions = [{ id: 0, biome, cells: ALL_CELLS.slice(), fringe: [] }];
  state.regionOfCell = new Array(ALL_CELLS.length).fill(0);
  state.phase = PHASES.ACTIONS;
  state.round = 1;
  state.activePlayer = 0;
  return state;
}

/** Pose une créature sans passer par l'invocation (pas de coût, pas de moitié). */
export function put(state, owner, instinct, x, y, extra = {}) {
  const cell = idx(x, y);
  const zone = extra.zone ?? null;
  const c = createCreature(state, { owner, instinct, cell, zone });
  Object.assign(c, extra.patch ?? {});
  return c;
}

export const at = (x, y) => idx(x, y);
export const xy = (cell) => [cell % W, (cell / W) | 0];
export const posOf = (c) => xy(c.cell).join(',');
export { INSTINCTS, BIOMES };
