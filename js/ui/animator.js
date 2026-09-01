/**
 * Rejoue la file d'événements du moteur en animations.
 *
 * La vue ne recalcule jamais rien : chaque animation est la mise en scène d'un
 * événement déjà résolu. Les mouvements et les attaques sont joués en parallèle
 * pour tenir la limite de ~1,2 s par phase (§7). Un clic passe l'animation.
 */

import { BIOME_META, xOf, yOf } from '../engine/index.js';
import { DEATH_SHARDS } from './assets.js';
import { el, nextFrame, reducedMotion } from './dom.js';

/** Durées en millisecondes — centralisées pour l'ajustement (§7). */
export const TIMINGS = {
  summon: 420,
  move: 500,
  attack: 420,
  death: 460,
  instinct: 400,
  biome: 520,
  card: 700,
  draw: 400,
  pause: 120,
};

export function createAnimator(boardView, hooks = {}) {
  let skipping = false;
  let running = false;

  const skip = () => {
    if (running) skipping = true;
  };
  document.addEventListener('click', skip);

  const delay = (ms) =>
    new Promise((resolve) => {
      if (skipping || reducedMotion()) return resolve();
      setTimeout(resolve, ms);
    });

  /**
   * Joue une file d'événements sur le plateau, puis resynchronise l'affichage
   * avec le state final.
   * @param {{type:string, payload:object}[]} events
   */
  async function play(events, state) {
    running = true;
    skipping = false;
    try {
      let i = 0;
      while (i < events.length) {
        const { type } = events[i];
        // Les événements de même nature qui se suivent sont joués ensemble.
        let j = i;
        while (j < events.length && events[j].type === type) j++;
        const group = events.slice(i, j).map((e) => e.payload);
        await playGroup(type, group, state);
        i = j;
      }
    } finally {
      running = false;
      skipping = false;
      boardView.render(state);
    }
  }

  async function playGroup(type, payloads, state) {
    switch (type) {
      case 'summon':
        return animateSummons(payloads, state);
      case 'move':
        return animateMoves(payloads);
      case 'push':
        return animateMoves(payloads);
      case 'attack':
        return animateAttacks(payloads);
      case 'damage':
        return animateDamage(payloads, state);
      case 'suddenDeath':
        return animateSuddenDeath(payloads, state);
      case 'regen':
        return animateRegen(payloads, state);
      case 'death':
      case 'crushed':
        return animateDeaths(payloads);
      case 'instinctChange':
        return animateInstinct(payloads, state);
      case 'biomeChange':
        return animateBiome(payloads, state);
      case 'lure':
        boardView.render(state);
        return delay(TIMINGS.pause);
      case 'phase':
        hooks.onPhase?.(payloads[0].name);
        return delay(TIMINGS.pause);
      default:
        return Promise.resolve();
    }
  }

  // -------------------------------------------------------------------------

  async function animateSummons(payloads, state) {
    boardView.render(state);
    for (const { id, cell } of payloads) {
      boardView.cellEl(cell)?.classList.add('pulse');
      boardView.creatureEl(id)?.classList.add('apparait');
    }
    await delay(TIMINGS.summon);
    for (const { id, cell } of payloads) {
      boardView.cellEl(cell)?.classList.remove('pulse');
      boardView.creatureEl(id)?.classList.remove('apparait');
    }
  }

  /** Translation fluide, toutes les créatures en parallèle. */
  async function animateMoves(payloads) {
    let moved = false;
    for (const { id, to } of payloads) {
      const node = boardView.creatureEl(id);
      if (!node) continue;
      node.classList.add('en-mouvement');
      node.style.setProperty('--x', xOf(to));
      node.style.setProperty('--y', yOf(to));
      moved = true;
    }
    if (!moved) return;
    await delay(TIMINGS.move);
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.remove('en-mouvement');
  }

  /**
   * Coup de boutoir vers la cible, flash blanc sur qui encaisse, et le nombre
   * de dégâts qui monte. Quand un protecteur absorbe, c'est lui qui encaisse
   * et le nombre s'affiche sur lui.
   */
  async function animateAttacks(payloads) {
    const touchees = new Set();
    for (const { id, targetId, from, to, dealt, absorbedBy } of payloads) {
      const attaquant = boardView.creatureEl(id);
      if (attaquant) {
        attaquant.style.setProperty('--dx', (xOf(to) - xOf(from)) * 0.25);
        attaquant.style.setProperty('--dy', (yOf(to) - yOf(from)) * 0.25);
        attaquant.classList.add('frappe');
      }
      const receveur = boardView.creatureEl(absorbedBy ?? targetId);
      if (receveur) {
        receveur.classList.add('touchee');
        touchees.add(receveur);
        if (dealt > 0) floatDamage(cellOfNode(receveur), dealt, absorbedBy ? 'absorbe' : 'degats');
      }
    }
    await delay(TIMINGS.attack);
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.remove('frappe');
    for (const node of touchees) node.classList.remove('touchee');
  }

  async function animateDamage(payloads, state) {
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.add('touchee');
    boardView.render(state);
    await delay(TIMINGS.pause * 2);
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.remove('touchee');
  }

  async function animateSuddenDeath(payloads, state) {
    for (const { id, amount } of payloads) {
      const node = boardView.creatureEl(id);
      if (node) floatDamage(cellOfNode(node), amount, 'degats');
    }
    boardView.render(state);
    await delay(TIMINGS.pause * 2);
  }

  async function animateRegen(payloads, state) {
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.add('regenere');
    boardView.render(state);
    await delay(TIMINGS.pause * 2);
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.remove('regenere');
  }

  /** La créature s'affaisse et se dissout en particules. */
  async function animateDeaths(payloads) {
    for (const { id, cell } of payloads) {
      const node = boardView.creatureEl(id);
      if (!node) continue;
      node.classList.add('meurt');
      scatter(cell ?? cellOfNode(node), node.dataset.owner);
    }
    await delay(TIMINGS.death);
  }

  async function animateInstinct(payloads, state) {
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.add('mue');
    await delay(TIMINGS.instinct / 2);
    boardView.render(state);
    await delay(TIMINGS.instinct / 2);
    for (const { id } of payloads) boardView.creatureEl(id)?.classList.remove('mue');
  }

  /** Les cases de la région se transforment en cascade depuis son centre. */
  async function animateBiome(payloads, state) {
    const cells = payloads.flatMap((p) => p.cells);
    const cx = cells.reduce((n, c) => n + xOf(c), 0) / cells.length;
    const cy = cells.reduce((n, c) => n + yOf(c), 0) / cells.length;
    const ordered = cells
      .map((cell) => ({ cell, d: Math.hypot(xOf(cell) - cx, yOf(cell) - cy) }))
      .sort((a, b) => a.d - b.d || a.cell - b.cell);

    for (const { cell, d } of ordered) {
      const node = boardView.cellEl(cell);
      node.style.setProperty('--retard', `${Math.round(d * 55)}ms`);
      node.classList.add('mute');
    }
    await nextFrame();
    boardView.render(state);
    await delay(TIMINGS.biome);
    for (const { cell } of ordered) {
      boardView.cellEl(cell).classList.remove('mute');
      boardView.cellEl(cell).style.removeProperty('--retard');
    }
  }

  // -------------------------------------------------------------------------

  const cellOfNode = (node) =>
    Number(node.style.getPropertyValue('--y')) * 8 + Number(node.style.getPropertyValue('--x'));

  /** Nombre de dégâts qui monte et s'estompe au-dessus de la cible. */
  function floatDamage(cell, amount, kind) {
    const node = el('div', {
      class: `nombre ${kind}`,
      text: kind === 'absorbe' ? `−${amount}` : `−${amount}`,
      style: { '--x': xOf(cell), '--y': yOf(cell) },
    });
    boardView.element.querySelector('.overlays').append(node);
    setTimeout(() => node.remove(), 900);
  }

  /** Éclats de dissolution. */
  function scatter(cell, owner) {
    const layer = boardView.element.querySelector('.overlays');
    const node = el('div', {
      class: 'particules',
      dataOwner: owner,
      style: { '--x': xOf(cell), '--y': yOf(cell) },
      html: `<svg viewBox="-20 -20 40 40">${DEATH_SHARDS.map(
        (d, i) => `<path d="${d}" style="--a:${(i / DEATH_SHARDS.length) * 360}deg"/>`
      ).join('')}</svg>`,
    });
    layer.append(node);
    setTimeout(() => node.remove(), 900);
  }

  return { play, skip, dispose: () => document.removeEventListener('click', skip), TIMINGS };
}

export const biomeLabel = (biome) => BIOME_META[biome].label;
