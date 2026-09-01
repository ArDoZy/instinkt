/**
 * Prévisualisations : ce que la vue montre au survol.
 *
 * Rien n'est recalculé ici — chaque information vient d'une fonction du moteur
 * (vision, décision d'instinct, intention de déplacement, cibles légales), de
 * sorte que ce qui est annoncé est exactement ce qui se produira.
 */

import {
  CARDS_BY_ID,
  INSTINCTS,
  creatureById,
  legalTargets,
  previewMove,
  squareCells,
  summonableCells,
  visibleCells,
} from '../engine/index.js';

/**
 * Aperçu d'une créature : sa vision, sa cible, la case où elle ira, et pour un
 * Territorial sa région entière.
 */
export function creaturePreview(state, creature) {
  const preview = { vision: [...visibleCells(state, creature)], marks: {}, ghost: [], paths: [] };

  if (creature.instinct === INSTINCTS.TERRITORIAL && creature.zone) {
    preview.marks.zone = creature.zone;
  }

  const { decision, destination, path } = previewMove(state, creature);
  if (decision) {
    const cible = decision.kind === 'creature' ? creatureById(state, decision.targetId) : null;
    const cell = cible ? cible.cell : decision.kind === 'cell' ? decision.cell : null;
    if (cell !== null) preview.line = [creature.cell, cell];
    if (decision.kind === 'flee') preview.marks.menace = [decision.fromCell];
  }
  if (destination !== creature.cell) {
    preview.ghost = [destination];
    preview.paths = [[creature.cell, ...path]];
  }
  return preview;
}

/** Cases de pose valides pour une invocation (§4). */
export function summonPreview(state, player) {
  return { marks: { legal: summonableCells(state, player) } };
}

/**
 * Cibles légales d'une carte. Les cibles illégales sont marquées pour être
 * grisées : une carte sans aucune cible ne peut pas être jouée (§6.9).
 */
export function cardPreview(state, player, cardId) {
  const card = CARDS_BY_ID[cardId];
  const targets = legalTargets(state, player, cardId);
  const marks = { legal: [], illegal: [] };

  if (card.target === 'global') {
    const concernees = card.id === 'lune_de_sang' || card.id === 'ecaille_de_pierre' ? player : 1 - player;
    marks.legal = state.creatures.filter((c) => c.hp > 0 && c.owner === concernees).map((c) => c.cell);
    return { marks, targets };
  }

  if (card.target === 'cell') {
    marks.legal = targets.map((t) => t.cell);
    return { marks, targets };
  }

  if (card.target === 'area2x2') {
    marks.legal = [...new Set(targets.flatMap((t) => squareCells(t.cell)))];
    return { marks, targets };
  }

  if (card.target.startsWith('region:')) {
    marks.legal = targets.flatMap((t) => state.regions[t.regionId].cells);
    return { marks, targets };
  }

  // Cartes visant une créature : on éclaire les créatures, on grise les autres.
  const legalIds = new Set(targets.map((t) => t.creatureId));
  for (const creature of state.creatures) {
    if (creature.hp <= 0) continue;
    (legalIds.has(creature.id) ? marks.legal : marks.illegal).push(creature.cell);
  }
  return { marks, targets };
}

/** Aperçu du carré 2×2 posé sous le curseur. */
export const areaPreview = (topLeft) => ({ marks: { zone: squareCells(topLeft) } });

/** Mode debug : la vision de toutes les créatures d'un coup (§9, palier 8). */
export function allVisionsPreview(state) {
  const vision = new Set();
  for (const creature of state.creatures) {
    if (creature.hp > 0) for (const cell of visibleCells(state, creature)) vision.add(cell);
  }
  return { vision: [...vision] };
}
