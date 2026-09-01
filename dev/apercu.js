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
  state.board = { ...state.board, tiles: new Array(64).fill(biome) };
  state.regions = [{ id: 0, biome, cells: ALL_CELLS.slice(), fringe: [] }];
  state.regionOfCell = new Array(64).fill(0);
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
      const chasseur = pose(state, 0, INSTINCTS.CHASSEUR, 1, 1);
      pose(state, 1, INSTINCTS.FUYARD, 5, 4);
      return [state, creaturePreview(state, chasseur)];
    },
  },
  {
    titre: 'Territorial — sa région entière est surlignée',
    build() {
      const state = plateau();
      const zone = [idx(2, 2), idx(3, 2), idx(2, 3), idx(3, 3), idx(4, 3)];
      const terri = pose(state, 0, INSTINCTS.TERRITORIAL, 2, 2, zone);
      pose(state, 1, INSTINCTS.CHAROGNARD, 5, 4);
      return [state, creaturePreview(state, terri)];
    },
  },
  {
    titre: 'Fuyard — la menace et sa case de repli',
    build() {
      const state = plateau(BIOMES.DESERT);
      const fuyard = pose(state, 0, INSTINCTS.FUYARD, 3, 3);
      pose(state, 1, INSTINCTS.CHASSEUR, 2, 2);
      return [state, creaturePreview(state, fuyard)];
    },
  },
  {
    titre: 'Carte ciblant un ennemi — cibles légales et grisées',
    build() {
      const state = plateau();
      pose(state, 0, INSTINCTS.PROTECTEUR, 2, 5);
      pose(state, 1, INSTINCTS.CHASSEUR, 4, 2);
      pose(state, 1, INSTINCTS.DOMINANT, 6, 1);
      return [state, cardPreview(state, 0, 'peur_devorante')];
    },
  },
  {
    titre: 'Invocation — cases de pose valides',
    build() {
      const state = plateau();
      state.board.tiles[idx(3, 1)] = BIOMES.MONTAGNE;
      pose(state, 0, INSTINCTS.CHASSEUR, 1, 1);
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
