/**
 * Banc d'essai des prévisualisations : quatre situations fabriquées à la main,
 * rendues avec exactement les mêmes modules que le jeu.
 */

import {
  BIOMES,
  INSTINCTS,
  PHASES,
  ALL_CELLS,
  createCreature,
  createGame,
  idx,
} from '../js/engine/index.js';
import { createBoardView } from '../js/ui/board-view.js';
import { creaturePreview, cardPreview, summonPreview } from '../js/ui/preview.js';
import { el } from '../js/ui/dom.js';

function plateau(biome = BIOMES.PLAINE) {
  const state = createGame({ seed: 12, decks: [[], []] });
  state.board = { ...state.board, tiles: new Array(ALL_CELLS.length).fill(biome) };
  state.regions = [{ id: 0, biome, cells: ALL_CELLS.slice(), fringe: [] }];
  state.regionOfCell = new Array(ALL_CELLS.length).fill(0);
  state.phase = PHASES.ACTIONS;
  state.round = 1;
  state.activePlayer = 0;
  return state;
}

const pose = (state, owner, instinct, x, y, zone = null) =>
  createCreature(state, { owner, instinct, cell: idx(x, y), zone });

const situations = [
  {
    titre: 'Chasseur — vision, cible, prochaine case',
    build() {
      const state = plateau();
      const chasseur = pose(state, 0, INSTINCTS.CHASSEUR, 2, 2);
      pose(state, 1, INSTINCTS.PROTECTEUR, 7, 6);
      return [state, creaturePreview(state, chasseur)];
    },
  },
  {
    titre: 'Territorial — sa région entière est surlignée',
    build() {
      const state = plateau();
      const zone = [idx(5, 5), idx(6, 5), idx(5, 6), idx(6, 6), idx(7, 6)];
      const terri = pose(state, 0, INSTINCTS.TERRITORIAL, 5, 5, zone);
      pose(state, 1, INSTINCTS.CHASSEUR, 8, 7);
      return [state, creaturePreview(state, terri)];
    },
  },
  {
    titre: 'Roi — la menace et sa case de repli',
    build() {
      const state = plateau(BIOMES.DESERT);
      const roi = pose(state, 0, INSTINCTS.ROI, 8, 8);
      pose(state, 1, INSTINCTS.TUEUR_DE_ROI, 7, 7);
      return [state, creaturePreview(state, roi)];
    },
  },
  {
    titre: 'Carte ciblant un ennemi — le Roi n’est pas ciblable',
    build() {
      const state = plateau();
      pose(state, 0, INSTINCTS.PROTECTEUR, 4, 10);
      pose(state, 1, INSTINCTS.CHASSEUR, 8, 5);
      pose(state, 1, INSTINCTS.ROI, 11, 3);
      return [state, cardPreview(state, 0, 'peur_devorante')];
    },
  },
  {
    titre: 'Tueur de Roi — il vise le Roi où qu’il soit',
    build() {
      const state = plateau(BIOMES.JUNGLE);
      const tueur = pose(state, 0, INSTINCTS.TUEUR_DE_ROI, 2, 13);
      pose(state, 1, INSTINCTS.ROI, 12, 3);
      return [state, creaturePreview(state, tueur)];
    },
  },
  {
    titre: 'Invocation — cases de pose valides',
    build() {
      const state = plateau();
      state.board.tiles[idx(3, 1)] = BIOMES.MONTAGNE;
      pose(state, 0, INSTINCTS.CHASSEUR, 2, 2);
      return [state, summonPreview(state, 0)];
    },
  },
];

const grille = el('div', { class: 'situations' });
document.querySelector('#situations').append(grille);

for (const situation of situations) {
  const hote = el('div', { class: 'situation' });
  grille.append(el('figure', {}, hote, el('figcaption', {}, situation.titre)));
  const view = createBoardView(hote, {});
  const [state, preview] = situation.build();
  view.render(state);
  view.applyPreview(preview);
}
