/**
 * Rendu de la grille. Cette couche ne calcule aucune règle : elle lit le state
 * et les prévisualisations que le moteur lui fournit.
 *
 * Les cases sont des éléments statiques ; les créatures sont des éléments
 * positionnés par transform au-dessus d'elles, ce qui permet une translation
 * fluide case à case sans reconstruire le DOM.
 */

import { BIOME_META, H, W, idx, xOf, yOf } from '../engine/index.js';
import { GLYPHS, LURE_MARKER, SILHOUETTES, WOUNDED_MARKER } from './assets.js';
import { el } from './dom.js';

export function createBoardView(container, handlers = {}) {
  const cases = el('div', { class: 'cases' });
  const traits = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  traits.setAttribute('class', 'calque-traits');
  traits.setAttribute('viewBox', `0 0 ${W} ${H}`);
  traits.setAttribute('preserveAspectRatio', 'none');
  const creaturesLayer = el('div', { class: 'creatures' });
  const overlays = el('div', { class: 'overlays' });

  const cellEls = [];
  for (let cell = 0; cell < W * H; cell++) {
    const node = el('div', {
      class: 'case',
      role: 'gridcell',
      dataCell: cell,
      // Curseur roulant : une seule case est dans l'ordre de tabulation.
      tabindex: cell === 0 ? '0' : '-1',
      onclick: () => handlers.onCell?.(cell),
      onmouseenter: () => handlers.onHoverCell?.(cell),
      onmouseleave: () => handlers.onHoverCell?.(null),
      onfocus: () => handlers.onHoverCell?.(cell),
      onblur: () => handlers.onHoverCell?.(null),
    });
    cellEls.push(node);
    cases.append(node);
  }

  // Le plateau se parcourt aussi au clavier : flèches pour se déplacer,
  // Entrée ou Espace pour agir sur la case.
  const DEPLACEMENTS = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };
  cases.addEventListener('keydown', (event) => {
    const cell = Number(event.target.dataset.cell);
    if (Number.isNaN(cell)) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      return handlers.onCell?.(cell);
    }
    const pas = DEPLACEMENTS[event.key];
    if (!pas) return;
    event.preventDefault();
    const x = Math.min(W - 1, Math.max(0, xOf(cell) + pas[0]));
    const y = Math.min(H - 1, Math.max(0, yOf(cell) + pas[1]));
    focusCell(idx(x, y));
  });

  function focusCell(cell) {
    for (const node of cellEls) node.tabIndex = -1;
    cellEls[cell].tabIndex = 0;
    cellEls[cell].focus();
  }

  const board = el('div', { class: 'plateau', role: 'grid' }, cases, traits, creaturesLayer, overlays, el('div', { class: 'mediane' }));
  container.append(board);

  /** @type {Map<number, HTMLElement>} */
  const creatureEls = new Map();

  function renderTerrain(state) {
    for (let cell = 0; cell < W * H; cell++) {
      const node = cellEls[cell];
      const biome = state.board.tiles[cell];
      if (node.dataset.biome !== biome) node.dataset.biome = biome;
      const region = state.regionOfCell[cell];
      const x = xOf(cell);
      const y = yOf(cell);
      toggle(node, 'bordHaut', y === 0 || state.regionOfCell[idx(x, y - 1)] !== region);
      toggle(node, 'bordBas', y === H - 1 || state.regionOfCell[idx(x, y + 1)] !== region);
      toggle(node, 'bordGauche', x === 0 || state.regionOfCell[idx(x - 1, y)] !== region);
      toggle(node, 'bordDroit', x === W - 1 || state.regionOfCell[idx(x + 1, y)] !== region);
      node.title = `${BIOME_META[biome].label} · vision ${BIOME_META[biome].visionMod >= 0 ? '+' : ''}${BIOME_META[biome].visionMod}`;
    }
  }

  function toggle(node, key, on) {
    if (on) node.dataset[key] = '';
    else delete node.dataset[key];
  }

  function renderCreatures(state) {
    const seen = new Set();
    for (const creature of state.creatures) {
      if (creature.hp <= 0) continue;
      seen.add(creature.id);
      let node = creatureEls.get(creature.id);
      if (!node) {
        node = buildCreature(creature);
        creatureEls.set(creature.id, node);
        creaturesLayer.append(node);
      }
      updateCreature(node, creature);
    }
    for (const [id, node] of creatureEls) {
      if (seen.has(id)) continue;
      node.remove();
      creatureEls.delete(id);
    }
  }

  function buildCreature(creature) {
    return el(
      'div',
      { class: 'creature', dataId: creature.id, dataOwner: creature.owner },
      el('div', { class: 'silhouette', html: SILHOUETTES[creature.instinct] }),
      el('div', { class: 'glyphe', html: GLYPHS[creature.instinct] }),
      el('div', { class: 'blesse', html: WOUNDED_MARKER }),
      el('div', { class: 'pv' }, el('i'))
    );
  }

  function updateCreature(node, creature) {
    node.style.setProperty('--x', xOf(creature.cell));
    node.style.setProperty('--y', yOf(creature.cell));
    node.dataset.instinct = creature.instinct;
    node.dataset.owner = creature.owner;
    node.classList.toggle('est-blessee', creature.hp < creature.maxHp / 2);
    node.querySelector('.silhouette').innerHTML = SILHOUETTES[creature.instinct];
    node.querySelector('.glyphe').innerHTML = GLYPHS[creature.instinct];
    node.querySelector('.pv i').style.width = `${Math.max(0, (creature.hp / creature.maxHp) * 100)}%`;
    node.title = `${creature.instinct} · ${creature.hp}/${creature.maxHp} PV`;
  }

  function renderLures(state) {
    overlays.querySelectorAll('.leurre').forEach((n) => n.remove());
    for (const player of state.players) {
      if (!player.lure) continue;
      overlays.append(
        el('div', {
          class: 'leurre',
          dataOwner: player.id,
          html: LURE_MARKER,
          style: { '--x': xOf(player.lure.cell), '--y': yOf(player.lure.cell) },
        })
      );
    }
  }

  /**
   * Applique les surbrillances. `preview` décrit ce que la vue doit montrer,
   * jamais ce qu'elle doit calculer.
   */
  function applyPreview(preview = {}) {
    for (const node of cellEls) {
      delete node.dataset.vision;
      delete node.dataset.horsVision;
      delete node.dataset.mark;
    }
    overlays.querySelectorAll('.fantome, .zone-cible').forEach((n) => n.remove());
    traits.replaceChildren();

    // La vision se lit surtout par contraste : on éteint ce qui est hors de portée.
    if (preview.vision && preview.vision.length) {
      const vus = new Set(preview.vision);
      for (let cell = 0; cell < cellEls.length; cell++) {
        if (vus.has(cell)) cellEls[cell].dataset.vision = '';
        else cellEls[cell].dataset.horsVision = '';
      }
    }
    for (const [mark, cells] of Object.entries(preview.marks ?? {})) {
      for (const cell of cells) cellEls[cell].dataset.mark = mark;
    }
    for (const cell of preview.ghost ?? []) {
      overlays.append(el('div', { class: 'fantome', style: { '--x': xOf(cell), '--y': yOf(cell) } }));
    }
    if (preview.line) {
      const [from, to] = preview.line;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', xOf(from) + 0.5);
      line.setAttribute('y1', yOf(from) + 0.5);
      line.setAttribute('x2', xOf(to) + 0.5);
      line.setAttribute('y2', yOf(to) + 0.5);
      line.setAttribute('class', 'trait-cible');
      traits.append(line);
    }
    for (const path of preview.paths ?? []) {
      if (path.length < 2) continue;
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', path.map((c) => `${xOf(c) + 0.5},${yOf(c) + 0.5}`).join(' '));
      poly.setAttribute('class', 'trait-chemin');
      traits.append(poly);
    }
  }

  function render(state) {
    renderTerrain(state);
    renderCreatures(state);
    renderLures(state);
  }

  return {
    element: board,
    render,
    applyPreview,
    creatureEl: (id) => creatureEls.get(id) ?? null,
    cellEl: (cell) => cellEls[cell],
    setSelected(id) {
      for (const [cid, node] of creatureEls) node.classList.toggle('selectionnee', cid === id);
    },
  };
}
