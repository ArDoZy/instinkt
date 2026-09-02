/**
 * Les six instincts : perception -> choix de cible -> objectif de déplacement.
 *
 * Aucune de ces fonctions ne modifie le state : elles décrivent une intention,
 * que resolution.js applique. Une créature sans cible ne bouge pas.
 */

import { INSTINCTS } from './constants.js';
import { EFFECTS, enemyLure, GLOBALS, getEffect, globalFor } from './effects.js';
import { isMindControllable, kingOf } from './creatures.js';
import { creatureById } from './state.js';
import { dist, neighbors8 } from './geometry.js';
import { visibleAllies, visibleCells, visibleEnemies } from './vision.js';

/**
 * Départage total et déterministe (§6.2) : distance la plus faible, puis PV
 * actuels les plus bas, puis identifiant d'invocation le plus petit.
 */
export function nearest(from, candidates, extra = null) {
  let best = null;
  for (const c of candidates) {
    if (best === null) {
      best = c;
      continue;
    }
    if (compareCandidates(from, c, best, extra) < 0) best = c;
  }
  return best;
}

function compareCandidates(from, a, b, extra) {
  const da = dist(from, a.cell);
  const db = dist(from, b.cell);
  if (da !== db) return da - db;
  if (extra) {
    const e = extra(a, b);
    if (e !== 0) return e;
  }
  if (a.hp !== b.hp) return a.hp - b.hp;
  return a.id - b.id;
}

/** Types de décision. */
export const chase = (creature) => ({ kind: 'creature', targetId: creature.id });
export const seek = (cell) => ({ kind: 'cell', cell });
export const flee = (fromCell) => ({ kind: 'flee', fromCell });
export const idle = () => null;

/**
 * Décision de la créature pour la phase courante, dans l'ordre de priorité du
 * §6.1 : Obsession, puis Appât, puis instinct.
 */
export function decide(state, creature) {
  const obsession = isMindControllable(creature) ? getEffect(creature, EFFECTS.OBSESSION) : null;
  if (obsession) {
    const prey = creatureById(state, obsession.targetId);
    // L'Obsession ignore la vision : la traque porte sur tout le plateau (§6.1).
    if (prey && prey.hp > 0) return chase(prey);
  }

  // Un fuyard ignore l'Appât : il ne cherche jamais rien. Le Roi aussi : rien
  // ne le détourne de sa fuite.
  if (creature.instinct !== INSTINCTS.FUYARD && isMindControllable(creature)) {
    const lure = enemyLure(state, creature);
    if (lure && visibleCells(state, creature).has(lure.cell)) return seek(lure.cell);
  }

  return INSTINCT_ALGORITHMS[creature.instinct](state, creature);
}

const INSTINCT_ALGORITHMS = {
  /** Cible la créature ennemie la plus proche dans sa vision. */
  [INSTINCTS.CHASSEUR](state, creature) {
    const prey = nearest(creature.cell, visibleEnemies(state, creature));
    return prey ? chase(prey) : idle();
  },

  /** S'éloigne de l'ennemi le plus proche ; immobile si aucun n'est visible. */
  [INSTINCTS.FUYARD](state, creature) {
    const threat = nearest(creature.cell, visibleEnemies(state, creature));
    return threat ? flee(threat.cell) : idle();
  },

  /**
   * Ne sort jamais de sa zone. Sa vision est sa zone plus le halo qui la borde,
   * ce dont visibleCells se charge. Hors de sa zone (Obsession ou Appât passés),
   * il n'a qu'un objectif : y revenir (§6.7).
   */
  [INSTINCTS.TERRITORIAL](state, creature) {
    if (creature.zone && !creature.zone.includes(creature.cell)) {
      const home = creature.zone.slice().sort((a, b) => dist(creature.cell, a) - dist(creature.cell, b) || a - b);
      return home.length ? { ...seek(home[0]), returning: true } : idle();
    }
    const prey = nearest(creature.cell, visibleEnemies(state, creature));
    return prey ? chase(prey) : idle();
  },

  /**
   * Cible l'allié le plus proche ; à distance égale, le plus blessé (§4).
   * Se place entre lui et l'ennemi le plus proche.
   */
  [INSTINCTS.PROTECTEUR](state, creature) {
    const ward = nearest(creature.cell, visibleAllies(state, creature), (a, b) => {
      const ra = a.hp / a.maxHp;
      const rb = b.hp / b.maxHp;
      return ra === rb ? 0 : ra - rb;
    });
    return ward ? { ...chase(ward), protecting: true } : idle();
  },

  /**
   * Le Roi évite les combats : il s'éloigne de l'ennemi le plus proche qu'il
   * voit, exactement comme un fuyard. Il n'engage jamais — il riposte
   * seulement, ce dont la phase de combat se charge.
   */
  [INSTINCTS.ROI](state, creature) {
    const menace = nearest(creature.cell, visibleEnemies(state, creature));
    return menace ? flee(menace.cell) : idle();
  },

  /**
   * Le tueur de Roi sait toujours où se trouve le Roi adverse, quelle que
   * soit la distance et quelle que soit sa vision : il va droit dessus.
   */
  [INSTINCTS.TUEUR_DE_ROI](state, creature) {
    const roi = kingOf(state, 1 - creature.owner);
    return roi ? chase(roi) : idle();
  },
};

/**
 * Cases d'arrivée acceptables pour une décision donnée.
 * Une créature qui poursuit s'arrête dès qu'elle est adjacente à sa cible :
 * elle ne dépasse jamais et ne tourne pas autour (§6.3).
 */
export function goalCells(state, creature, decision, blocked) {
  if (!decision) return [];
  if (decision.kind === 'cell') {
    return blocked.has(decision.cell) ? [] : [decision.cell];
  }
  if (decision.kind === 'creature') {
    const prey = creatureById(state, decision.targetId);
    if (!prey) return [];
    let cells = neighbors8(prey.cell).filter((c) => !blocked.has(c));
    // Le Territorial ne sort jamais de sa zone (§4).
    if (creature.instinct === INSTINCTS.TERRITORIAL && creature.zone) {
      const zone = new Set(creature.zone);
      cells = cells.filter((c) => zone.has(c));
    }
    return cells;
  }
  return [];
}

/**
 * Départage entre cases d'arrivée également proches. Le protecteur se place en
 * priorité entre son protégé et l'ennemi le plus proche : il préfère donc, à
 * distance de marche égale, la case la plus proche de cette menace (§4).
 */
export function goalRank(state, creature, decision) {
  if (!decision || !decision.protecting) return null;
  const ward = creatureById(state, decision.targetId);
  const threat = ward ? nearest(ward.cell, visibleEnemies(state, creature)) : null;
  return threat ? (cell) => dist(cell, threat.cell) : null;
}
