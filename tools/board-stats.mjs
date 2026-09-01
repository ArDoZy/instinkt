/**
 * Statistiques de génération sur un grand nombre de graines.
 * Sert à la passe d'équilibrage : `node tools/board-stats.mjs 5000`.
 */

import { createRng, generateBoard, computeRegions, isPassableCell, ALL_CELLS, halfOfCell, BIOME_LIST, BIOME_META, renderBiomes } from '../js/engine/index.js';

const n = Number(process.argv[2] ?? 2000);
const regionCounts = new Map();
const biomeCells = Object.fromEntries(BIOME_LIST.map((b) => [b, 0]));
let attemptsTotal = 0;
let minFree = Infinity;

for (let seed = 1; seed <= n; seed++) {
  const { board, attempts } = generateBoard(createRng(seed));
  attemptsTotal += attempts;
  const { regions } = computeRegions(board);
  regionCounts.set(regions.length, (regionCounts.get(regions.length) ?? 0) + 1);
  const halves = [0, 0];
  for (const c of ALL_CELLS) {
    biomeCells[board.tiles[c]]++;
    if (isPassableCell(board, c)) halves[halfOfCell(c)]++;
  }
  minFree = Math.min(minFree, halves[0], halves[1]);
}

const cells = n * ALL_CELLS.length;
console.log(`${n} plateaux générés`);
console.log(`Tentatives moyennes : ${(attemptsTotal / n).toFixed(2)}`);
console.log(`Cases libres minimum sur une moitié : ${minFree}`);
console.log('\nRégions par plateau');
for (const k of [...regionCounts.keys()].sort((a, b) => a - b)) {
  const share = (regionCounts.get(k) / n) * 100;
  console.log(`  ${k} : ${'█'.repeat(Math.round(share / 2)).padEnd(50)} ${share.toFixed(1)}%`);
}
console.log('\nRépartition des biomes');
for (const b of BIOME_LIST) {
  const share = (biomeCells[b] / cells) * 100;
  console.log(`  ${BIOME_META[b].label.padEnd(9)} ${'█'.repeat(Math.round(share / 2)).padEnd(25)} ${share.toFixed(1)}%`);
}
console.log('\nExemple (graine 1)\n');
console.log(renderBiomes(generateBoard(createRng(1)).board));
