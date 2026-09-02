/**
 * Cartes d'influence : cibles légales et application des effets.
 *
 * Règle de ciblage (§5) : les malus ne visent que les créatures adverses, les
 * bonus que les créatures alliées, les cartes de terrain n'importe quelle région.
 * Une carte sans cible légale ne peut pas être jouée (§6.9).
 */

import { BALANCE, BIOMES, CARDS_BY_ID, INSTINCTS, TERRAIN_TRANSFORMS } from './constants.js';
import { EFFECTS, GLOBALS, addEffect } from './effects.js';
import { changeInstinct } from './creatures.js';
import { withBiome } from './board.js';
import { ALL_CELLS, H, W, dist, idx, xOf, yOf } from './geometry.js';
import { creatureById, isCellFree, livingCreatures, pushEvent, refreshRegions, regionOf } from './state.js';

const alliesOf = (state, player) => livingCreatures(state).filter((c) => c.owner === player);
const enemiesOf = (state, player) => livingCreatures(state).filter((c) => c.owner !== player);

/** Régions d'un biome donné. */
const regionsOfBiome = (state, biome) => state.regions.filter((r) => r.biome === biome);

/**
 * Cibles légales d'une carte, sous forme de liste d'objets `target` acceptables
 * par `applyCard`. Une liste vide interdit de jouer la carte.
 */
export function legalTargets(state, player, cardId) {
  const card = CARDS_BY_ID[cardId];
  if (!card) return [];

  if (card.target === 'global') {
    // Les cartes globales ont besoin d'au moins une créature à affecter.
    const pool = card.id === 'lune_de_sang' || card.id === 'ecaille_de_pierre' ? alliesOf(state, player) : enemiesOf(state, player);
    return pool.length ? [{}] : [];
  }

  if (card.target === 'ally') return alliesOf(state, player).map((c) => ({ creatureId: c.id }));

  if (card.target === 'enemy') return enemiesOf(state, player).map((c) => ({ creatureId: c.id }));

  if (card.target === 'enemy+ally') {
    const targets = [];
    for (const enemy of enemiesOf(state, player)) {
      for (const ally of alliesOf(state, player)) {
        targets.push({ creatureId: enemy.id, allyId: ally.id });
      }
    }
    return targets;
  }

  if (card.target === 'cell') {
    // Le leurre se pose sur une case libre non-montagne, n'importe où (§6.9).
    return ALL_CELLS.filter((cell) => isCellFree(state, cell)).map((cell) => ({ cell }));
  }

  if (card.target === 'area2x2') {
    const targets = [];
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const cells = squareCells(idx(x, y));
        if (enemiesOf(state, player).some((c) => cells.includes(c.cell))) targets.push({ cell: idx(x, y) });
      }
    }
    return targets;
  }

  if (card.target.startsWith('region:')) {
    const biome = card.target.slice('region:'.length);
    return regionsOfBiome(state, biome).map((r) => ({ regionId: r.id }));
  }

  return [];
}

/** Les 4 cases d'un carré 2×2 dont `topLeft` est le coin supérieur gauche. */
export function squareCells(topLeft) {
  const x = xOf(topLeft);
  const y = yOf(topLeft);
  return [idx(x, y), idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)];
}

/** Une cible proposée fait-elle partie des cibles légales ? */
export function isLegalTarget(state, player, cardId, target) {
  const wanted = JSON.stringify(normalize(target));
  return legalTargets(state, player, cardId).some((t) => JSON.stringify(normalize(t)) === wanted);
}

const normalize = (t = {}) =>
  Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined && v !== null).sort());

/** Ajoute un effet global portant sur les créatures présentes au lancement (§6.9). */
function addGlobal(state, kind, caster, creatures, remaining) {
  const existing = state.globalEffects.find((e) => e.kind === kind && e.caster === caster);
  const creatureIds = creatures.map((c) => c.id).sort((a, b) => a - b);
  if (existing) {
    existing.remaining = remaining;
    existing.creatureIds = creatureIds;
    return existing;
  }
  const effect = { kind, caster, remaining, creatureIds };
  state.globalEffects.push(effect);
  return effect;
}

function morph(state, creature, instinct, zone, cause) {
  const change = changeInstinct(state, creature, instinct, { zone, permanent: true });
  pushEvent(state, 'instinctChange', { id: creature.id, from: change.before, to: change.after, cause });
}

/**
 * Applique l'effet d'une carte. Le coût et la légalité sont vérifiés en amont
 * par le moteur.
 */
export function applyCard(state, player, cardId, target = {}) {
  const D = BALANCE.durations;
  const creature = target.creatureId ? creatureById(state, target.creatureId) : null;

  switch (cardId) {
    case 'retour_instinct_primordial':
      morph(state, creature, INSTINCTS.CHASSEUR, null, cardId);
      break;

    case 'peur_devorante':
      morph(state, creature, INSTINCTS.FUYARD, null, cardId);
      break;

    case 'terrain_sacre':
      // La zone est la région où elle se trouve, figée à cet instant (§6.7).
      morph(state, creature, INSTINCTS.TERRITORIAL, regionOf(state, creature.cell).cells.slice(), cardId);
      break;

    case 'obsession':
      addEffect(creature, {
        kind: EFFECTS.OBSESSION,
        caster: player,
        remaining: D.obsession,
        targetId: target.allyId,
        previousInstinct: creature.instinct,
        previousZone: creature.zone,
      });
      pushEvent(state, 'obsession', { id: creature.id, targetId: target.allyId });
      break;

    case 'panique_collective': {
      const cells = squareCells(target.cell);
      for (const victim of enemiesOf(state, player).filter((c) => cells.includes(c.cell))) {
        // Panique mémorise l'instinct du moment ; c'est celui-là qui revient (§6.6).
        addEffect(victim, {
          kind: EFFECTS.PANIQUE,
          caster: player,
          remaining: D.paniqueCollective,
          previousInstinct: victim.instinct,
          previousZone: victim.zone,
        });
        const change = changeInstinct(state, victim, INSTINCTS.FUYARD, { permanent: false });
        pushEvent(state, 'instinctChange', { id: victim.id, from: change.before, to: change.after, cause: cardId });
      }
      pushEvent(state, 'area', { cells, cause: cardId });
      break;
    }

    case 'hierarchie_brisee':
      addGlobal(state, GLOBALS.HIERARCHIE_BRISEE, player, enemiesOf(state, player), D.hierarchieBrisee);
      break;

    case 'frenesie':
      addEffect(creature, { kind: EFFECTS.FRENESIE, caster: player, remaining: D.frenesie });
      break;

    case 'carapace':
      addEffect(creature, { kind: EFFECTS.CARAPACE, caster: player, remaining: D.carapace });
      break;

    case 'appat':
      // Un seul leurre par joueur : en poser un second retire le premier (§6.9).
      state.players[player].lure = { cell: target.cell, remaining: D.appat, caster: player };
      pushEvent(state, 'lure', { player, cell: target.cell });
      break;

    case 'lune_de_sang':
      addGlobal(state, GLOBALS.LUNE_DE_SANG, player, alliesOf(state, player), D.luneDeSang);
      break;

    case 'brouillard_epais':
      addGlobal(state, GLOBALS.BROUILLARD, player, enemiesOf(state, player), D.brouillardEpais);
      break;

    case 'ecaille_de_pierre':
      addGlobal(state, GLOBALS.ECAILLE_DE_PIERRE, player, alliesOf(state, player), D.ecailleDePierre);
      break;

    case 'feu_de_foret':
    case 'secheresse':
    case 'poussee_volcanique':
    case 'fertilisation':
      transformRegion(state, cardId, target.regionId);
      break;

    default:
      throw new Error(`applyCard: carte inconnue ${cardId}`);
  }
}

/** Transformation de biome d'une région entière. */
function transformRegion(state, cardId, regionId) {
  const region = state.regions[regionId];
  const cells = region.cells.slice();
  const { to } = TERRAIN_TRANSFORMS[cardId];

  state.board = withBiome(state.board, cells, to);
  refreshRegions(state);
  pushEvent(state, 'biomeChange', { cells, biome: to, cause: cardId });

  if (to === BIOMES.MONTAGNE) pushOutOfMountain(state, cells);
}

/**
 * Poussée Volcanique : chaque créature de la région est repoussée vers la case
 * libre la plus proche hors de la nouvelle montagne ; à défaut, elle est
 * détruite. Résolu par ordre d'identifiant croissant (§6.9).
 */
function pushOutOfMountain(state, cells) {
  const zoneSet = new Set(cells);
  const victims = livingCreatures(state)
    .filter((c) => zoneSet.has(c.cell))
    .sort((a, b) => a.id - b.id);

  for (const creature of victims) {
    const landing = ALL_CELLS.filter(
      (cell) => !zoneSet.has(cell) && isCellFree(state, cell) && dist(creature.cell, cell) <= BALANCE.volcanicPushRadius
    ).sort((a, b) => dist(creature.cell, a) - dist(creature.cell, b) || a - b);

    if (landing.length === 0) {
      creature.hp = 0;
      pushEvent(state, 'crushed', { id: creature.id, cell: creature.cell });
      continue;
    }
    const from = creature.cell;
    creature.cell = landing[0];
    pushEvent(state, 'push', { id: creature.id, from, to: creature.cell });
  }

  // Un Territorial dont la zone a entièrement disparu est détruit (§6.7).
  for (const creature of livingCreatures(state)) {
    if (creature.instinct !== INSTINCTS.TERRITORIAL || !creature.zone) continue;
    if (creature.zone.every((cell) => zoneSet.has(cell))) {
      creature.hp = 0;
      pushEvent(state, 'crushed', { id: creature.id, cell: creature.cell, cause: 'zoneLost' });
    }
  }
}
