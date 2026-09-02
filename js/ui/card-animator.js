/**
 * Mise en scène des cartes : pioche, jeu, défausse (§7).
 *
 * Les cartes animées sont des clones posés dans une couche au-dessus de tout ;
 * la main réelle est re-rendue par le moteur, ces clones ne servent qu'au
 * mouvement entre deux états.
 */

import { CARDS_BY_ID, W } from '../engine/index.js';
import { cardBack, cardGhost } from './card-view.js';
import { el, reducedMotion } from './dom.js';

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

export function createCardAnimator({ layer, pile, hand, boardView }) {
  /** Position d'un élément, en coordonnées de la couche d'animation. */
  function rect(node) {
    const base = layer.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return { x: box.left - base.left, y: box.top - base.top, w: box.width, h: box.height };
  }

  const pileRect = () => (pile() ? rect(pile()) : { x: 0, y: 0, w: 90, h: 126 });
  const handRect = () => (hand() ? rect(hand()) : pileRect());

  function place(node, { x, y, scale = 1, rotate = 0, opacity = 1 }) {
    node.style.setProperty('--tx', `${x}px`);
    node.style.setProperty('--ty', `${y}px`);
    node.style.setProperty('--sc', scale);
    node.style.setProperty('--rot', `${rotate}deg`);
    node.style.opacity = opacity;
  }

  /**
   * Pioche : la carte glisse de la pile vers la main, avec une légère rotation
   * et un retournement dos → face à mi-parcours.
   */
  async function draw(cardId) {
    const card = CARDS_BY_ID[cardId];
    if (!card) return;
    const depart = pileRect();
    const arrivee = handRect();

    const node = el('div', { class: 'carte-animee retourne' }, cardBack('recto'), cardGhost(card, 'verso'));
    layer.append(node);
    place(node, { x: depart.x, y: depart.y, scale: 0.7, rotate: -8 });
    await attendre(20);
    node.classList.add('en-vol');
    place(node, { x: arrivee.x + arrivee.w - 140, y: arrivee.y, scale: 1, rotate: 0 });
    await attendre(400);
    node.remove();
  }

  /**
   * Jeu d'une carte : elle s'élève au centre, s'y maintient le temps que son
   * effet parte vers la cible, puis se dissout vers la pile. Un trait d'énergie
   * relie la carte à la case ciblée.
   */
  async function play(cardId, target) {
    const card = CARDS_BY_ID[cardId];
    if (!card) return;
    const depart = handRect();
    const centre = rect(layer);

    const node = cardGhost(card, 'carte-animee en-vol');
    layer.append(node);
    place(node, { x: depart.x, y: depart.y, scale: 1 });
    await attendre(20);
    place(node, { x: centre.w / 2 - 66, y: centre.h / 2 - 86, scale: 1.6 });
    await attendre(320);

    const trait = energyLine(centre, target);
    if (trait) layer.append(trait);
    await attendre(300);

    node.classList.add('se-dissout');
    const pileP = pileRect();
    place(node, { x: pileP.x, y: pileP.y, scale: 0.5, opacity: 0 });
    await attendre(320);
    node.remove();
    trait?.remove();
  }

  /** Trait d'énergie de la carte vers la case ciblée. */
  function energyLine(centre, target) {
    const cell = targetCell(target);
    if (cell === null) return null;
    const box = rect(boardView.cellEl(cell));
    const x1 = centre.w / 2;
    const y1 = centre.h / 2;
    const x2 = box.x + box.w / 2;
    const y2 = box.y + box.h / 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'trait-energie');
    svg.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    return svg;
  }

  /** La case visée, quand la carte en désigne une. */
  function targetCell(target) {
    if (!target) return null;
    if (typeof target.cell === 'number') return target.cell;
    if (typeof target.creatureId === 'number') {
      const node = boardView.creatureEl(target.creatureId);
      if (!node) return null;
      return Number(node.style.getPropertyValue('--y')) * W + Number(node.style.getPropertyValue('--x'));
    }
    return null;
  }

  /** Défausse : la carte choisie tombe vers la pile. */
  async function discard(cardId) {
    const card = CARDS_BY_ID[cardId];
    if (!card) return;
    const depart = handRect();
    const pileP = pileRect();
    const node = cardGhost(card, 'carte-animee en-vol');
    layer.append(node);
    place(node, { x: depart.x, y: depart.y, scale: 1 });
    await attendre(20);
    place(node, { x: pileP.x, y: pileP.y + 40, scale: 0.5, rotate: 14, opacity: 0 });
    await attendre(360);
    node.remove();
  }

  return { draw, play, discard };
}
