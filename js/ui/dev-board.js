/**
 * Harnais de mise au point du palier 1 : visualise la génération de plateau.
 * Seule cette couche touche au DOM ; le moteur ne la connaît pas.
 */

import {
  BIOME_META,
  createGame,
  createRng,
  generateBoard,
  computeRegions,
  isPassableCell,
  renderBiomes,
  ALL_CELLS,
  W,
  H,
  idx,
  halfOfCell,
  cellName,
} from '../engine/index.js';

const $ = (sel) => document.querySelector(sel);
const plateau = $('#plateau');
const champSeed = $('#seed');

function borders(regionOfCell, cell) {
  const x = cell % W;
  const y = (cell / W) | 0;
  const r = regionOfCell[cell];
  return {
    haut: y === 0 || regionOfCell[idx(x, y - 1)] !== r,
    bas: y === H - 1 || regionOfCell[idx(x, y + 1)] !== r,
    gauche: x === 0 || regionOfCell[idx(x - 1, y)] !== r,
    droit: x === W - 1 || regionOfCell[idx(x + 1, y)] !== r,
  };
}

function drawBoard(board, regionOfCell) {
  plateau.replaceChildren();
  for (const cell of ALL_CELLS) {
    const el = document.createElement('div');
    el.className = 'case';
    el.dataset.biome = board.tiles[cell];
    el.title = `${cellName(cell)} · ${BIOME_META[board.tiles[cell]].label} · région ${regionOfCell[cell]}`;
    const b = borders(regionOfCell, cell);
    if (b.haut) el.dataset.bordHaut = '';
    if (b.bas) el.dataset.bordBas = '';
    if (b.gauche) el.dataset.bordGauche = '';
    if (b.droit) el.dataset.bordDroit = '';

    const label = document.createElement('span');
    label.className = 'etiquette-region';
    label.textContent = regionOfCell[cell];
    el.append(label);
    plateau.append(el);
  }
  const mediane = document.createElement('div');
  mediane.className = 'mediane';
  plateau.append(mediane);
}

function fillStats(board, regions, extra) {
  const halves = [0, 0];
  for (const c of ALL_CELLS) if (isPassableCell(board, c)) halves[halfOfCell(c)]++;
  const counts = {};
  for (const c of ALL_CELLS) counts[board.tiles[c]] = (counts[board.tiles[c]] ?? 0) + 1;

  const rows = [
    ['Graine', extra.seed],
    ['Tentatives', extra.attempts],
    ['Régions', regions.length],
    ['Cases libres J1 / J2', `${halves[0]} / ${halves[1]}`],
    ...Object.entries(BIOME_META).map(([key, meta]) => [meta.label, counts[key] ?? 0]),
  ];

  $('#stats').replaceChildren(
    ...rows.map(([k, v]) => {
      const div = document.createElement('div');
      div.className = 'ligne';
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = String(v);
      div.append(dt, dd);
      return div;
    })
  );
}

function fillLegend() {
  $('#legende').replaceChildren(
    ...Object.entries(BIOME_META).map(([key, meta]) => {
      const span = document.createElement('span');
      const dot = document.createElement('i');
      dot.className = 'pastille';
      dot.style.background = `var(${meta.color})`;
      const mod = key === 'montagne' ? 'infranchissable' : `vision ${meta.visionMod >= 0 ? '+' : ''}${meta.visionMod}`;
      span.append(dot, document.createTextNode(`${meta.label} — ${mod}`));
      return span;
    })
  );
}

function show(seed) {
  const { board, attempts } = generateBoard(createRng(seed));
  const { regions, regionOfCell } = computeRegions(board);
  drawBoard(board, regionOfCell);
  fillStats(board, regions, { seed, attempts });
  $('#ascii').textContent = renderBiomes(board);
  champSeed.value = seed;
  // Vérifie au passage que le state complet se construit sur cette graine.
  const game = createGame({ seed, decks: [[], []] });
  $('#etat').textContent =
    `state : ${JSON.stringify(game).length} octets JSON · ` +
    `Joueur ${game.firstPlacer + 1} place en premier · Joueur ${game.activePlayer + 1} joue la 1re manche`;
}

$('#regenerer').addEventListener('click', () => show((Math.random() * 0xffffffff) >>> 0));
champSeed.addEventListener('change', () => show(Number(champSeed.value) >>> 0));
$('#regions').addEventListener('change', (e) => {
  plateau.dataset.regions = e.target.checked ? 'on' : 'off';
});

fillLegend();
show(20260901);
