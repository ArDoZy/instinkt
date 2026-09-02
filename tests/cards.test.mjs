/**
 * Palier 4 : cartes d'influence — ciblage, effets, durées, pioche.
 */

import { describe, it, assert, equal, deepEqual, run } from './harness.mjs';
import { flatGame, put, at } from './helpers.mjs';
import {
  ACTIONS,
  BALANCE,
  BIOMES,
  CARDS,
  EFFECTS,
  GLOBALS,
  INSTINCTS,
  IllegalAction,
  applyAction,
  applyCard,
  createGame,
  dist,
  H,
  W,
  getEffect,
  hasEffect,
  legalTargets,
  playableCards,
  refreshRegions,
  squareCells,
  stats,
  visibleCells,
  PHASES,
} from '../js/engine/index.js';

const play = (state, player, cardId, target = {}) => {
  applyCard(state, player, cardId, target);
  return state;
};

describe('Ciblage', () => {
  it('les malus ne visent que l’adversaire, les bonus que ses alliés', () => {
    const state = flatGame();
    const allie = put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    const ennemi = put(state, 1, INSTINCTS.CHASSEUR, 7, 7);

    deepEqual(legalTargets(state, 0, 'frenesie'), [{ creatureId: allie.id }]);
    deepEqual(legalTargets(state, 0, 'peur_devorante'), [{ creatureId: ennemi.id }]);
    deepEqual(legalTargets(state, 0, 'carapace'), [{ creatureId: allie.id }]);
  });

  it('une carte sans cible légale ne peut pas être jouée', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    deepEqual(legalTargets(state, 0, 'peur_devorante'), [], 'aucun ennemi');
    deepEqual(legalTargets(state, 0, 'feu_de_foret'), [], 'aucune forêt sur un plateau de plaine');

    state.players[0].hand = ['peur_devorante'];
    state.players[0].energy = 10;
    const jouables = playableCards(state, 0);
    equal(jouables[0].legal, false);

    let refuse = false;
    try {
      applyAction(state, { type: ACTIONS.PLAY_CARD, player: 0, cardId: 'peur_devorante', target: { creatureId: 99 } });
    } catch (e) {
      refuse = e instanceof IllegalAction;
    }
    assert(refuse, 'le moteur refuse une cible illégale');
    equal(state.players[0].energy, 10, "l'énergie n'est pas dépensée");
  });

  it('le carré 2×2 tient entièrement sur la grille', () => {
    const state = flatGame();
    put(state, 1, INSTINCTS.CHASSEUR, 15, 15);
    const cibles = legalTargets(state, 0, 'panique_collective');
    // Une créature dans le coin n'est couverte que par un seul carré.
    equal(cibles.length, 1);
    assert(squareCells(cibles[0].cell).includes(at(15, 15)));
    for (const cible of cibles) {
      for (const cell of squareCells(cible.cell)) assert(cell >= 0 && cell < W * H);
    }
  });

  it('l’appât se pose sur n’importe quelle case libre non-montagne', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    state.board.tiles[at(1, 1)] = BIOMES.MONTAGNE;
    const cells = legalTargets(state, 0, 'appat').map((t) => t.cell);
    assert(!cells.includes(at(0, 0)), 'pas sur une créature');
    assert(!cells.includes(at(1, 1)), 'pas sur la montagne');
    equal(cells.length, W * H - 2, 'toutes les autres cases');
  });
});

describe('Manipulation des instincts', () => {
  it('reporte les PV au prorata, minimum 1', () => {
    const state = flatGame();
    // La moitié des PV d'un protecteur, reportée sur les PV max d'un chasseur.
    const avant = BALANCE.creatures[INSTINCTS.PROTECTEUR].hp;
    const apres = BALANCE.creatures[INSTINCTS.CHASSEUR].hp;
    const c = put(state, 0, INSTINCTS.PROTECTEUR, 0, 0, { patch: { hp: avant / 2 } });
    play(state, 0, 'retour_instinct_primordial', { creatureId: c.id });
    equal(c.instinct, INSTINCTS.CHASSEUR);
    equal(c.maxHp, apres);
    equal(c.hp, Math.round(apres / 2), 'PV reportés au prorata');
  });

  it('conserve les effets temporaires en cours', () => {
    const state = flatGame();
    const c = put(state, 0, INSTINCTS.PROTECTEUR, 0, 0);
    play(state, 0, 'frenesie', { creatureId: c.id });
    play(state, 0, 'retour_instinct_primordial', { creatureId: c.id });
    assert(hasEffect(c, EFFECTS.FRENESIE), 'la Frénésie survit au changement d’instinct');
  });

  it('Terrain Sacré fige la région où se trouve la créature', () => {
    const state = flatGame();
    const c = put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    play(state, 0, 'terrain_sacre', { creatureId: c.id });
    equal(c.instinct, INSTINCTS.TERRITORIAL);
    equal(c.zone.length, W * H, 'toute la région de plaine');
  });

  it('Panique Collective ne dure que 2 tours et rend l’instinct mémorisé', () => {
    let state = flatGame();
    put(state, 0, INSTINCTS.ROI, 0, 0);
    put(state, 1, INSTINCTS.ROI, 15, 15);
    const victime = put(state, 1, INSTINCTS.CHASSEUR, 6, 6);
    state.players[0].energy = 10;
    state.players[0].hand = ['panique_collective'];
    state.activePlayer = 0;

    state = applyAction(state, {
      type: ACTIONS.PLAY_CARD,
      player: 0,
      cardId: 'panique_collective',
      target: { cell: at(6, 6) },
    });
    const cible = state.creatures.find((c) => c.id === victime.id);
    equal(cible.instinct, INSTINCTS.FUYARD);
    equal(cible.maxHp, BALANCE.creatures.fuyard.hp);

    // Deux manches complètes du lanceur avant le retour à l'instinct d'origine.
    state = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(state.creatures.find((c) => c.id === victime.id).instinct, INSTINCTS.FUYARD, 'toujours paniquée');
    state = applyAction(state, { type: ACTIONS.END_TURN, player: 1 });
    state = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(state.creatures.find((c) => c.id === victime.id).instinct, INSTINCTS.CHASSEUR, 'elle redevient chasseuse');
  });

  it('un changement permanent annule une panique en cours', () => {
    const state = flatGame();
    const c = put(state, 1, INSTINCTS.CHASSEUR, 6, 6);
    play(state, 0, 'panique_collective', { cell: at(6, 6) });
    assert(hasEffect(c, EFFECTS.PANIQUE));
    play(state, 0, 'peur_devorante', { creatureId: c.id });
    assert(!hasEffect(c, EFFECTS.PANIQUE), 'elle ne reviendra pas à son ancien instinct');
  });

  it('Obsession mémorise l’instinct du moment', () => {
    const state = flatGame();
    const allie = put(state, 0, INSTINCTS.PROTECTEUR, 0, 0);
    const ennemi = put(state, 1, INSTINCTS.TUEUR_DE_ROI, 7, 7);
    play(state, 0, 'obsession', { creatureId: ennemi.id, allyId: allie.id });
    const effet = getEffect(ennemi, EFFECTS.OBSESSION);
    equal(effet.targetId, allie.id);
    equal(effet.previousInstinct, INSTINCTS.TUEUR_DE_ROI);
    equal(effet.remaining, null, 'permanente jusqu’à la mort de la cible');
  });

  it('aucune de ces cartes ne peut viser un Roi', () => {
    const state = flatGame();
    const roiAllie = put(state, 0, INSTINCTS.ROI, 0, 0);
    const roiAdverse = put(state, 1, INSTINCTS.ROI, 15, 15);
    for (const carte of ['retour_instinct_primordial', 'terrain_sacre', 'peur_devorante', 'obsession']) {
      const cibles = legalTargets(state, 0, carte).map((t) => t.creatureId);
      assert(!cibles.includes(roiAllie.id) && !cibles.includes(roiAdverse.id), carte);
    }
    // Panique Collective laisse le Roi indemne dans son carré.
    play(state, 0, 'panique_collective', { cell: at(14, 14) });
    equal(roiAdverse.instinct, INSTINCTS.ROI);
  });
});

describe('Buffs et effets globaux', () => {
  it('Frénésie : +2 ATK, +1 vitesse', () => {
    const state = flatGame();
    const c = put(state, 0, INSTINCTS.PROTECTEUR, 0, 0);
    const avant = stats(state, c);
    play(state, 0, 'frenesie', { creatureId: c.id });
    const apres = stats(state, c);
    equal(apres.atk, avant.atk + 2);
    equal(apres.speed, avant.speed + 1);
  });

  it('un même effet rafraîchit sa durée sans s’empiler', () => {
    const state = flatGame();
    const c = put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    play(state, 0, 'frenesie', { creatureId: c.id });
    getEffect(c, EFFECTS.FRENESIE).remaining = 1;
    play(state, 0, 'frenesie', { creatureId: c.id });
    equal(c.effects.length, 1);
    equal(getEffect(c, EFFECTS.FRENESIE).remaining, BALANCE.durations.frenesie);
  });

  it('Lune de Sang ne profite qu’aux chasseurs et dominants alliés', () => {
    const state = flatGame();
    const chasseur = put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    const protecteur = put(state, 0, INSTINCTS.PROTECTEUR, 1, 0);
    const ennemi = put(state, 1, INSTINCTS.CHASSEUR, 7, 7);
    play(state, 0, 'lune_de_sang');
    equal(stats(state, chasseur).atk, BALANCE.creatures.chasseur.atk + 1);
    equal(stats(state, protecteur).atk, BALANCE.creatures.protecteur.atk, 'pas les protecteurs');
    equal(stats(state, ennemi).atk, BALANCE.creatures.chasseur.atk, 'pas l’adversaire');
  });

  it('une créature invoquée après un effet global n’en bénéficie pas', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    play(state, 0, 'lune_de_sang');
    const tardif = put(state, 0, INSTINCTS.CHASSEUR, 1, 0);
    equal(stats(state, tardif).atk, BALANCE.creatures.chasseur.atk);
  });

  it('Brouillard Épais ramène la vision adverse à 1', () => {
    const state = flatGame({ biome: BIOMES.DESERT });
    const ennemi = put(state, 1, INSTINCTS.CHASSEUR, 3, 3);
    equal(stats(state, ennemi).vision, 7);
    play(state, 0, 'brouillard_epais');
    equal(stats(state, ennemi).vision, 1, 'ramenée, pas modifiée');
  });

  it('le brouillard réduit aussi la perception d’un Territorial', () => {
    const state = flatGame();
    const zone = [at(2, 2), at(3, 2), at(4, 2)];
    const terri = put(state, 1, INSTINCTS.TERRITORIAL, 2, 2, { zone });
    assert(visibleCells(state, terri).has(at(4, 2)));
    play(state, 0, 'brouillard_epais');
    assert(!visibleCells(state, terri).has(at(4, 2)), 'il ne voit plus que ce qui le touche');
  });

  it('Appât : un seul leurre par joueur', () => {
    const state = flatGame();
    play(state, 0, 'appat', { cell: at(3, 3) });
    equal(state.players[0].lure.cell, at(3, 3));
    play(state, 0, 'appat', { cell: at(5, 5) });
    equal(state.players[0].lure.cell, at(5, 5), 'le second remplace le premier');
  });
});

describe('Contrôle du terrain', () => {
  it('transforme toute la région et recalcule les régions', () => {
    const state = flatGame({ biome: BIOMES.FORET });
    equal(state.regions.length, 1);
    play(state, 0, 'feu_de_foret', { regionId: 0 });
    assert(state.board.tiles.every((t) => t === BIOMES.PLAINE));
    equal(state.regions[0].biome, BIOMES.PLAINE);
  });

  it('chaîne les transformations forêt → plaine → désert → montagne', () => {
    const state = flatGame({ biome: BIOMES.FORET });
    play(state, 0, 'feu_de_foret', { regionId: 0 });
    equal(state.board.tiles[0], BIOMES.PLAINE);
    play(state, 0, 'secheresse', { regionId: 0 });
    equal(state.board.tiles[0], BIOMES.DESERT);
  });

  /** Pose une région de désert au milieu de la plaine et renvoie son id. */
  function desertAt(state, cells) {
    for (const cell of cells) state.board.tiles[cell] = BIOMES.DESERT;
    refreshRegions(state);
    return state.regions.find((r) => r.biome === BIOMES.DESERT).id;
  }

  it('Poussée Volcanique repousse les créatures hors de la montagne', () => {
    const state = flatGame({ biome: BIOMES.PLAINE });
    const region = desertAt(state, [at(3, 3), at(4, 3)]);
    const c = put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    play(state, 0, 'poussee_volcanique', { regionId: region });

    equal(state.board.tiles[at(3, 3)], BIOMES.MONTAGNE);
    assert(c.hp > 0, 'elle survit');
    assert(state.board.tiles[c.cell] !== BIOMES.MONTAGNE, 'repoussée hors de la montagne');
    equal(dist(c.cell, at(3, 3)), 1, 'vers la case libre la plus proche');
  });

  it('détruit une créature qui n’a aucune case de repli à distance 2', () => {
    const state = flatGame({ biome: BIOMES.PLAINE });
    // Un bloc de désert de 5×5 : le centre est à plus de 2 cases de la sortie.
    const cells = [];
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) cells.push(at(x, y));
    const region = desertAt(state, cells);
    const piegee = put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    play(state, 0, 'poussee_volcanique', { regionId: region });
    equal(piegee.hp, 0, 'écrasée');
  });

  it('détruit un Territorial dont la zone disparaît', () => {
    const state = flatGame({ biome: BIOMES.PLAINE });
    const region = desertAt(state, [at(3, 3), at(4, 3)]);
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 3, 3, { zone: [at(3, 3), at(4, 3)] });
    play(state, 0, 'poussee_volcanique', { regionId: region });
    equal(terri.hp, 0, 'sa zone n’existe plus');
  });

  it('Fertilisation rend une montagne franchissable', () => {
    const state = flatGame({ biome: BIOMES.PLAINE });
    for (const cell of [at(0, 0), at(1, 0)]) state.board.tiles[cell] = BIOMES.MONTAGNE;
    refreshRegions(state);
    const region = state.regions.find((r) => r.biome === BIOMES.MONTAGNE).id;
    play(state, 0, 'fertilisation', { regionId: region });
    equal(state.board.tiles[at(0, 0)], BIOMES.FORET);
  });
});

describe('Pioche et main', () => {
  const deck = CARDS.slice(0, 6).map((c) => c.id);

  it('pioche une carte par manche et cycle le deck', () => {
    let state = createGame({ seed: 3, decks: [deck, deck] });
    state.phase = PHASES.ACTIONS;
    state.round = 1;
    state.creatures = [];
    put(state, 0, INSTINCTS.ROI, 0, 0);
    put(state, 1, INSTINCTS.ROI, 15, 15);
    state.activePlayer = 0;

    const avant = state.players[1].draw.length;
    state = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(state.players[1].hand.length, 1);
    equal(state.players[1].draw.length, avant - 1);
  });

  it('une carte jouée retourne en bas de la pioche', () => {
    let state = flatGame({ decks: [deck, deck] });
    put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    put(state, 1, INSTINCTS.CHASSEUR, 15, 15);
    state.players[0].hand = ['frenesie'];
    state.players[0].energy = 10;
    const pioche = state.players[0].draw.length;
    state = applyAction(state, {
      type: ACTIONS.PLAY_CARD,
      player: 0,
      cardId: 'frenesie',
      target: { creatureId: state.creatures[0].id },
    });
    equal(state.players[0].hand.length, 0);
    equal(state.players[0].draw.length, pioche + 1);
    equal(state.players[0].draw.at(-1), 'frenesie');
  });

  it('main pleine : le joueur pioche puis doit défausser', () => {
    let state = flatGame({ decks: [deck, deck] });
    put(state, 0, INSTINCTS.ROI, 0, 0);
    put(state, 1, INSTINCTS.ROI, 15, 15);
    state.players[1].hand = deck.slice(0, 4);
    state.activePlayer = 0;

    state = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(state.players[1].hand.length, 5);
    equal(state.pendingDiscard, 1);

    let bloque = false;
    try {
      applyAction(state, { type: ACTIONS.END_TURN, player: 1 });
    } catch (e) {
      bloque = e instanceof IllegalAction;
    }
    assert(bloque, 'aucune autre action tant que la défausse n’est pas faite');

    const rejete = state.players[1].hand[0];
    state = applyAction(state, { type: ACTIONS.DISCARD, player: 1, cardId: rejete });
    equal(state.players[1].hand.length, BALANCE.hand.max);
    equal(state.players[1].draw.at(-1), rejete, 'la défausse repart en bas de la pioche');
    equal(state.pendingDiscard, null);
  });
});

run();
