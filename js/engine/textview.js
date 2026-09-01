/**
 * Rendu texte du plateau — outil de mise au point, sans aucun accès au DOM.
 */

import { BIOME_META, INSTINCT_LIST } from './constants.js';
import { H, W, idx } from './geometry.js';
import { creatureAt } from './state.js';

const INSTINCT_LETTER = Object.fromEntries(
  INSTINCT_LIST.map((name) => [name, name[0].toUpperCase()])
);

/** Grille des biomes : une lettre par case (F/J/P/D/M). */
export function renderBiomes(board) {
  const rows = [];
  rows.push('   ' + Array.from({ length: W }, (_, x) => String.fromCharCode(97 + x)).join(' '));
  for (let y = 0; y < H; y++) {
    const cells = [];
    for (let x = 0; x < W; x++) cells.push(BIOME_META[board.tiles[idx(x, y)]].short);
    rows.push(`${y}  ${cells.join(' ')}`);
    if (y === H / 2 - 1) rows.push('   ' + '-'.repeat(W * 2 - 1));
  }
  return rows.join('\n');
}

/** Grille des régions : un caractère base36 par région. */
export function renderRegions(state) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    const cells = [];
    for (let x = 0; x < W; x++) cells.push(state.regionOfCell[idx(x, y)].toString(36));
    rows.push(`${y}  ${cells.join(' ')}`);
  }
  return rows.join('\n');
}

/**
 * Grille de jeu : lettre d'instinct en majuscule pour le joueur A, en
 * minuscule pour le joueur B ; biome en gris pour les cases vides.
 */
export function renderBoard(state) {
  const rows = [];
  rows.push('   ' + Array.from({ length: W }, (_, x) => String.fromCharCode(97 + x)).join(' '));
  for (let y = 0; y < H; y++) {
    const cells = [];
    for (let x = 0; x < W; x++) {
      const cell = idx(x, y);
      const creature = creatureAt(state, cell);
      if (creature) {
        const letter = INSTINCT_LETTER[creature.instinct];
        cells.push(creature.owner === 0 ? letter : letter.toLowerCase());
      } else {
        cells.push(BIOME_META[state.board.tiles[cell]].short.toLowerCase());
      }
    }
    rows.push(`${y}  ${cells.join(' ')}`);
    if (y === H / 2 - 1) rows.push('   ' + '-'.repeat(W * 2 - 1));
  }
  return rows.join('\n');
}

/** Résumé d'une créature pour le journal console. */
export function describeCreature(c) {
  return `#${c.id} ${c.instinct} J${c.owner + 1} ${c.hp}/${c.maxHp}PV`;
}
