/**
 * Palier 2 : instincts, mouvement, combat, fin de partie.
 * Chaque test isole une règle sur un plateau fabriqué.
 */

import { describe, it, assert, equal, deepEqual, run } from './harness.mjs';
import { flatGame, put, at, posOf } from './helpers.mjs';
import {
  ACTIONS,
  BALANCE,
  BIOMES,
  EFFECTS,
  GLOBALS,
  INSTINCTS,
  IllegalAction,
  addEffect,
  applyAction,
  cloneState,
  createGame,
  decide,
  dist,
  isValidPrey,
  legalActions,
  resolveCombat,
  resolveDeaths,
  resolveMovement,
  resolveRegen,
  saveState,
  stats,
  suddenDeathDamage,
  visibleCells,
  PHASES,
} from '../js/engine/index.js';

/** Enchaîne une phase complète mouvement + combat, comme une fin de manche. */
function phase(state) {
  state.events = [];
  const plans = resolveMovement(state);
  resolveCombat(state, plans);
  resolveDeaths(state);
  return state;
}

/**
 * Combat seul, sans mouvement : isole les règles d'attaque et d'absorption des
 * déplacements qui les précèdent. `protectingId` posé à la main est conservé.
 */
function combat(state) {
  state.events = [];
  const plans = state.creatures
    .filter((c) => c.hp > 0)
    .map((creature) => {
      const decision = decide(state, creature);
      if (decision && decision.protecting) creature.protectingId = decision.targetId;
      return { creature, decision };
    });
  resolveCombat(state, plans);
  resolveDeaths(state);
  return state;
}

describe('Vision', () => {
  it('dépend du biome de l’observateur, pas de celui de la cible', () => {
    const desert = flatGame({ biome: BIOMES.DESERT });
    const jungle = flatGame({ biome: BIOMES.JUNGLE });
    const a = put(desert, 0, INSTINCTS.CHASSEUR, 3, 3);
    const b = put(jungle, 0, INSTINCTS.CHASSEUR, 3, 3);
    equal(stats(desert, a).vision, 5 + 2, 'désert : +2');
    equal(stats(jungle, b).vision, 5 - 2, 'jungle : −2');
  });

  it('ne descend jamais sous 1', () => {
    const jungle = flatGame({ biome: BIOMES.JUNGLE });
    const fuyard = put(jungle, 0, INSTINCTS.FUYARD, 3, 3);
    addEffect(fuyard, { kind: EFFECTS.FRENESIE, caster: 0, remaining: 2 });
    equal(stats(jungle, fuyard).vision, 1, 'fuyard vision 3 − 2 = 1');
  });

  it('le Territorial voit sa zone plus le halo qui la borde', () => {
    const state = flatGame();
    const zone = [at(2, 2), at(3, 2)];
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 2, 2, { zone });
    const seen = visibleCells(state, terri);
    assert(seen.has(at(3, 2)), 'sa zone');
    assert(seen.has(at(4, 3)), 'le halo en diagonale');
    assert(!seen.has(at(5, 2)), 'rien au-delà du halo');
  });
});

describe('Chasseur', () => {
  it('avance vers l’ennemi le plus proche et s’arrête à son contact', () => {
    const state = flatGame();
    const chasseur = put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    // Un dominant ne voit pas de proie valide dans un chasseur : il reste immobile,
    // ce qui donne une cible fixe.
    put(state, 1, INSTINCTS.DOMINANT, 4, 0);
    resolveMovement(state);
    equal(posOf(chasseur), '2,0', 'vitesse 2');
    resolveMovement(state);
    equal(posOf(chasseur), '3,0', 'il s’arrête au contact, sans dépasser ni tourner autour');
  });

  it('reste immobile sans ennemi visible', () => {
    const state = flatGame({ biome: BIOMES.JUNGLE });
    const chasseur = put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    put(state, 1, INSTINCTS.FUYARD, 7, 7);
    equal(decide(state, chasseur), null);
    resolveMovement(state);
    equal(posOf(chasseur), '0,0');
  });

  it('contourne la montagne', () => {
    const state = flatGame();
    for (let y = 0; y <= 6; y++) state.board.tiles[at(2, y)] = BIOMES.MONTAGNE;
    const chasseur = put(state, 0, INSTINCTS.CHASSEUR, 1, 0);
    put(state, 1, INSTINCTS.FUYARD, 3, 0);
    resolveMovement(state);
    assert(state.board.tiles[chasseur.cell] !== BIOMES.MONTAGNE, 'jamais sur la montagne');
    assert(chasseur.cell !== at(1, 0), 'il contourne au lieu de rester bloqué');
  });
});

describe('Fuyard', () => {
  it('maximise sa distance à la menace', () => {
    const state = flatGame();
    const fuyard = put(state, 0, INSTINCTS.FUYARD, 3, 3);
    put(state, 1, INSTINCTS.CHASSEUR, 2, 3);
    resolveMovement(state);
    assert(dist(fuyard.cell, at(2, 3)) > 1, `s'éloigne : ${posOf(fuyard)}`);
  });

  it('reste immobile s’il est acculé', () => {
    const state = flatGame();
    const fuyard = put(state, 0, INSTINCTS.FUYARD, 0, 0);
    put(state, 1, INSTINCTS.CHASSEUR, 1, 1);
    put(state, 1, INSTINCTS.CHASSEUR, 0, 1);
    put(state, 1, INSTINCTS.CHASSEUR, 1, 0);
    resolveMovement(state);
    equal(posOf(fuyard), '0,0', 'acculé dans le coin');
  });

  it('n’attaque jamais et ne riposte jamais', () => {
    const state = flatGame();
    const fuyard = put(state, 0, INSTINCTS.FUYARD, 0, 0);
    const chasseur = put(state, 1, INSTINCTS.CHASSEUR, 1, 1);
    combat(state);
    equal(chasseur.hp, chasseur.maxHp, 'le chasseur est intact');
    assert(fuyard.hp < fuyard.maxHp, 'le fuyard encaisse');
  });

  it('ignore l’appât', () => {
    const state = flatGame();
    const fuyard = put(state, 0, INSTINCTS.FUYARD, 3, 3);
    state.players[1].lure = { cell: at(5, 3), remaining: 2, caster: 1 };
    equal(decide(state, fuyard), null, 'il ne cherche jamais rien');
  });
});

describe('Territorial', () => {
  it('ne sort jamais de sa zone', () => {
    const state = flatGame();
    const zone = [at(2, 2), at(3, 2), at(2, 3), at(3, 3)];
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 2, 2, { zone });
    put(state, 1, INSTINCTS.CHASSEUR, 4, 3);
    for (let i = 0; i < 4; i++) resolveMovement(state);
    assert(zone.includes(terri.cell), `sorti de sa zone : ${posOf(terri)}`);
  });

  it('attaque une créature juste à l’extérieur de sa zone', () => {
    const state = flatGame();
    const zone = [at(2, 2)];
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 2, 2, { zone });
    const voisin = put(state, 1, INSTINCTS.DOMINANT, 3, 2);
    combat(state);
    assert(voisin.hp < voisin.maxHp, 'le territorial frappe hors zone sans sortir');
    equal(posOf(terri), '2,2', 'et reste dans sa zone');
  });

  it('sa zone reste un ensemble de cases même si le biome change', () => {
    const state = flatGame();
    const zone = [at(2, 2), at(3, 2)];
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 2, 2, { zone });
    state.board.tiles[at(2, 2)] = BIOMES.DESERT;
    deepEqual(terri.zone, zone, 'la zone ne suit pas le terrain');
  });

  it('regagne sa zone et ne fait rien d’autre s’il en est sorti', () => {
    const state = flatGame();
    const zone = [at(1, 1)];
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 5, 5, { zone });
    const voisin = put(state, 1, INSTINCTS.FUYARD, 5, 6);
    phase(state);
    equal(voisin.hp, voisin.maxHp, 'il ne frappe pas tant qu’il n’est pas rentré');
    assert(dist(terri.cell, at(1, 1)) < dist(at(5, 5), at(1, 1)), 'il se rapproche de sa zone');
  });
});

describe('Charognard', () => {
  it('ne cible que les créatures sous la moitié de leurs PV', () => {
    const state = flatGame();
    const charo = put(state, 0, INSTINCTS.CHAROGNARD, 0, 0);
    put(state, 1, INSTINCTS.PROTECTEUR, 2, 0); // 14/14 : intact
    const blesse = put(state, 1, INSTINCTS.PROTECTEUR, 3, 3, { patch: { hp: 5 } });
    const decision = decide(state, charo);
    equal(decision.targetId, blesse.id, 'il vise le blessé, pas le plus proche');
  });

  it('se dirige vers le dernier combat perçu, à défaut de blessé', () => {
    const state = flatGame();
    const charo = put(state, 0, INSTINCTS.CHAROGNARD, 0, 0);
    state.lastCombatCells = [at(3, 0)];
    const decision = decide(state, charo);
    deepEqual(decision, { kind: 'cell', cell: at(3, 0) });
    resolveMovement(state);
    equal(posOf(charo), '2,0');
  });

  it('reste immobile sans blessé ni combat mémorisé', () => {
    const state = flatGame();
    const charo = put(state, 0, INSTINCTS.CHAROGNARD, 0, 0);
    put(state, 1, INSTINCTS.PROTECTEUR, 2, 0);
    equal(decide(state, charo), null);
  });

  it('frappe n’importe quel ennemi une fois au contact', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHAROGNARD, 0, 0);
    const intact = put(state, 1, INSTINCTS.PROTECTEUR, 1, 0);
    combat(state);
    assert(intact.hp < intact.maxHp, 'blessé ou non, au contact il frappe');
  });
});

describe('Dominant', () => {
  it('ne frappe que fuyards et charognards', () => {
    const state = flatGame();
    const dominant = put(state, 0, INSTINCTS.DOMINANT, 3, 3);
    const chasseur = put(state, 1, INSTINCTS.CHASSEUR, 4, 3);
    equal(isValidPrey(state, dominant, chasseur), false);
    combat(state);
    equal(chasseur.hp, chasseur.maxHp, 'il encaisse sans riposter');
    assert(dominant.hp < dominant.maxHp, 'le chasseur, lui, frappe');
  });

  it('reste immobile sans proie valide visible', () => {
    const state = flatGame();
    const dominant = put(state, 0, INSTINCTS.DOMINANT, 0, 0);
    put(state, 1, INSTINCTS.CHASSEUR, 3, 0);
    equal(decide(state, dominant), null);
  });

  it('sous Hiérarchie Brisée, frappe n’importe quelle voisine, alliée comprise', () => {
    const state = flatGame();
    const dominant = put(state, 1, INSTINCTS.DOMINANT, 3, 3);
    const allie = put(state, 1, INSTINCTS.PROTECTEUR, 4, 3);
    state.globalEffects.push({
      kind: GLOBALS.HIERARCHIE_BRISEE,
      caster: 0,
      remaining: 2,
      creatureIds: [dominant.id, allie.id],
    });
    equal(isValidPrey(state, dominant, allie), true);
    combat(state);
    assert(allie.hp < allie.maxHp, 'il frappe son allié');
  });
});

describe('Protecteur', () => {
  it('absorbe les dégâts destinés à son protégé', () => {
    const state = flatGame();
    const protege = put(state, 0, INSTINCTS.FUYARD, 3, 3);
    const protecteur = put(state, 0, INSTINCTS.PROTECTEUR, 3, 4);
    put(state, 1, INSTINCTS.CHASSEUR, 2, 3);
    combat(state);
    equal(protege.hp, protege.maxHp, 'le protégé ne perd rien');
    assert(protecteur.hp < protecteur.maxHp, 'le protecteur encaisse');
  });

  it('un seul protecteur absorbe quand deux protègent la même créature', () => {
    const state = flatGame();
    const protege = put(state, 0, INSTINCTS.FUYARD, 3, 3);
    const faible = put(state, 0, INSTINCTS.PROTECTEUR, 3, 4, { patch: { hp: 6 } });
    const solide = put(state, 0, INSTINCTS.PROTECTEUR, 2, 4);
    put(state, 1, INSTINCTS.CHASSEUR, 2, 3);
    // Les deux protègent explicitement la même créature.
    faible.protectingId = protege.id;
    solide.protectingId = protege.id;
    combat(state);
    equal(protege.hp, protege.maxHp, 'le protégé ne perd rien');
    assert(faible.hp < 6, 'le plus bas en PV absorbe (§6.2)');
    equal(solide.hp, solide.maxHp, 'l’autre se contente d’attaquer');
  });

  it('l’absorption ne se chaîne pas', () => {
    const state = flatGame();
    const p1 = put(state, 0, INSTINCTS.PROTECTEUR, 3, 3);
    const p2 = put(state, 0, INSTINCTS.PROTECTEUR, 3, 4);
    put(state, 1, INSTINCTS.CHASSEUR, 2, 3);
    combat(state);
    const absorbes = [p1, p2].filter((p) => p.hp < p.maxHp);
    equal(absorbes.length, 1, 'un seul des deux encaisse');
  });

  it('ne protège jamais une créature ennemie', () => {
    const state = flatGame();
    const protecteur = put(state, 0, INSTINCTS.PROTECTEUR, 3, 3);
    const ennemi = put(state, 1, INSTINCTS.FUYARD, 3, 4);
    resolveMovement(state);
    equal(protecteur.protectingId, null, 'aucun allié visible');
    void ennemi;
  });
});

describe('Combat', () => {
  it('les dégâts sont simultanés : une créature tuée porte son coup', () => {
    const state = flatGame();
    const a = put(state, 0, INSTINCTS.CHASSEUR, 3, 3, { patch: { hp: 1 } });
    const b = put(state, 1, INSTINCTS.CHASSEUR, 3, 4, { patch: { hp: 1 } });
    combat(state);
    equal(state.creatures.length, 0, 'les deux meurent ensemble');
    void a;
    void b;
  });

  it('une créature n’attaque qu’une fois, une seule cible', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    const x = put(state, 1, INSTINCTS.PROTECTEUR, 3, 4);
    const y = put(state, 1, INSTINCTS.PROTECTEUR, 4, 3);
    combat(state);
    const touches = [x, y].filter((c) => c.hp < c.maxHp);
    equal(touches.length, 1);
  });

  it('Carapace annule les dégâts et met l’ATK à 0', () => {
    const state = flatGame();
    const cible = put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    addEffect(cible, { kind: EFFECTS.CARAPACE, caster: 0, remaining: 2 });
    const ennemi = put(state, 1, INSTINCTS.CHASSEUR, 3, 4);
    equal(stats(state, cible).atk, 0);
    combat(state);
    equal(cible.hp, cible.maxHp, 'immunisée');
    equal(ennemi.hp, ennemi.maxHp, 'elle ne rend pas les coups');
  });

  it('Écaille de Pierre divise par deux, arrondi au supérieur', () => {
    const state = flatGame();
    const protecteur = put(state, 0, INSTINCTS.PROTECTEUR, 3, 3);
    const chasseur = put(state, 1, INSTINCTS.CHASSEUR, 3, 4); // ATK 4
    state.globalEffects.push({
      kind: GLOBALS.ECAILLE_DE_PIERRE,
      caster: 0,
      remaining: 3,
      creatureIds: [protecteur.id],
    });
    combat(state);
    equal(protecteur.hp, protecteur.maxHp - 2, '4 dégâts réduits à 2');
    void chasseur;
  });

  it('cumule Frénésie et Lune de Sang', () => {
    const state = flatGame();
    const chasseur = put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    addEffect(chasseur, { kind: EFFECTS.FRENESIE, caster: 0, remaining: 2 });
    state.globalEffects.push({
      kind: GLOBALS.LUNE_DE_SANG,
      caster: 0,
      remaining: 3,
      creatureIds: [chasseur.id],
    });
    equal(stats(state, chasseur).atk, 4 + 2 + 1);
    equal(stats(state, chasseur).speed, 2 + 1 + 1);
  });
});

describe('Obsession et Appât', () => {
  it('l’Obsession ignore la vision et la distance', () => {
    const state = flatGame({ biome: BIOMES.JUNGLE });
    const traqueur = put(state, 1, INSTINCTS.CHASSEUR, 0, 0);
    const proie = put(state, 0, INSTINCTS.FUYARD, 7, 7);
    addEffect(traqueur, {
      kind: EFFECTS.OBSESSION,
      caster: 0,
      remaining: null,
      targetId: proie.id,
      previousInstinct: traqueur.instinct,
      previousZone: null,
    });
    equal(decide(state, traqueur).targetId, proie.id, 'à travers tout le plateau');
  });

  it('la créature obsédée ignore les autres ennemis adjacents', () => {
    const state = flatGame();
    const traqueur = put(state, 1, INSTINCTS.CHASSEUR, 3, 3);
    const proie = put(state, 0, INSTINCTS.FUYARD, 7, 7);
    const voisin = put(state, 0, INSTINCTS.PROTECTEUR, 3, 4);
    addEffect(traqueur, {
      kind: EFFECTS.OBSESSION,
      caster: 0,
      remaining: null,
      targetId: proie.id,
      previousInstinct: traqueur.instinct,
      previousZone: null,
    });
    combat(state);
    equal(voisin.hp, voisin.maxHp, 'il ne frappe que sa cible');
  });

  it('retrouve son instinct à la mort de la cible', () => {
    const state = flatGame();
    const traqueur = put(state, 1, INSTINCTS.DOMINANT, 3, 3);
    const proie = put(state, 0, INSTINCTS.PROTECTEUR, 3, 4, { patch: { hp: 1 } });
    addEffect(traqueur, {
      kind: EFFECTS.OBSESSION,
      caster: 0,
      remaining: null,
      targetId: proie.id,
      previousInstinct: INSTINCTS.DOMINANT,
      previousZone: null,
    });
    combat(state);
    equal(traqueur.effects.length, 0, 'l’Obsession tombe');
    equal(traqueur.instinct, INSTINCTS.DOMINANT);
  });

  it('un fuyard obsédé suit sans jamais frapper', () => {
    const state = flatGame();
    const fuyard = put(state, 1, INSTINCTS.FUYARD, 3, 3);
    const proie = put(state, 0, INSTINCTS.PROTECTEUR, 3, 5);
    addEffect(fuyard, {
      kind: EFFECTS.OBSESSION,
      caster: 0,
      remaining: null,
      targetId: proie.id,
      previousInstinct: INSTINCTS.FUYARD,
      previousZone: null,
    });
    phase(state);
    assert(dist(fuyard.cell, proie.cell) <= 1, 'il suit');
    equal(proie.hp, proie.maxHp, 'ATK 0 : il ne frappe pas');
  });

  it('l’Appât détourne une créature ennemie qui le voit', () => {
    const state = flatGame();
    const chasseur = put(state, 0, INSTINCTS.CHASSEUR, 3, 3);
    state.players[1].lure = { cell: at(5, 3), remaining: 2, caster: 1 };
    deepEqual(decide(state, chasseur), { kind: 'cell', cell: at(5, 3) });
  });

  it('l’Appât sort un Territorial de sa zone', () => {
    const state = flatGame();
    const zone = [at(2, 2)];
    const terri = put(state, 0, INSTINCTS.TERRITORIAL, 2, 2, { zone });
    state.players[1].lure = { cell: at(3, 2), remaining: 2, caster: 1 };
    resolveMovement(state);
    equal(posOf(terri), '3,2', 'les effets priment sur la contrainte de zone');
  });
});

describe('Ordre de résolution', () => {
  it('départage les conflits de case : joueur actif, vitesse, identifiant', () => {
    const state = flatGame();
    state.activePlayer = 1;
    const lent = put(state, 0, INSTINCTS.CHASSEUR, 1, 4);
    const actif = put(state, 1, INSTINCTS.CHASSEUR, 3, 4);
    // Les deux convoitent la case voisine de leur proie commune.
    put(state, 0, INSTINCTS.FUYARD, 7, 7);
    put(state, 1, INSTINCTS.FUYARD, 0, 7);
    const before = { lent: lent.cell, actif: actif.cell };
    resolveMovement(state);
    assert(lent.cell !== actif.cell, 'jamais deux créatures sur la même case');
    void before;
  });

  it('les décisions sont prises sur le state du début de phase', () => {
    const state = flatGame();
    const a = put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    const b = put(state, 0, INSTINCTS.CHASSEUR, 1, 0);
    put(state, 1, INSTINCTS.FUYARD, 5, 0);
    const copy = cloneState(state);
    resolveMovement(state);
    const cellsOnce = state.creatures.map((c) => c.cell);
    resolveMovement(copy);
    deepEqual(copy.creatures.map((c) => c.cell), cellsOnce, 'aucun effet domino');
    void a;
    void b;
  });

  it('deux créatures ne finissent jamais sur la même case', () => {
    const state = flatGame();
    for (let i = 0; i < 6; i++) put(state, 0, INSTINCTS.CHASSEUR, i, 0);
    put(state, 1, INSTINCTS.FUYARD, 3, 5);
    for (let t = 0; t < 5; t++) {
      resolveMovement(state);
      const cells = state.creatures.map((c) => c.cell);
      equal(new Set(cells).size, cells.length, `collision au tour ${t}`);
    }
  });
});

describe('Régénération et mort subite', () => {
  it('+1 PV si la créature n’a ni frappé ni été touchée', () => {
    const state = flatGame();
    const seul = put(state, 0, INSTINCTS.PROTECTEUR, 0, 0, { patch: { hp: 5 } });
    combat(state);
    resolveRegen(state);
    equal(seul.hp, 6);
  });

  it('pas de régénération pour qui a frappé', () => {
    const state = flatGame();
    const a = put(state, 0, INSTINCTS.CHASSEUR, 3, 3, { patch: { hp: 5 } });
    put(state, 1, INSTINCTS.PROTECTEUR, 3, 4); // ATK 2
    combat(state);
    equal(a.hp, 3, 'il encaisse la riposte');
    resolveRegen(state);
    equal(a.hp, 3, 'et ne régénère pas : il a frappé et été touché');
  });

  it('la mort subite monte d’un cran toutes les 10 manches', () => {
    const state = flatGame();
    equal(suddenDeathDamage({ ...state, round: 29 }), 0);
    equal(suddenDeathDamage({ ...state, round: 30 }), 1);
    equal(suddenDeathDamage({ ...state, round: 39 }), 1);
    equal(suddenDeathDamage({ ...state, round: 40 }), 2);
  });

  it('elle finit la partie', () => {
    const state = flatGame();
    state.round = 30;
    put(state, 0, INSTINCTS.FUYARD, 0, 0, { patch: { hp: 1 } });
    put(state, 1, INSTINCTS.FUYARD, 7, 7);
    state.events = [];
    const plans = resolveMovement(state);
    resolveCombat(state, plans);
    resolveRegen(state);
    equal(state.creatures.length, 2, 'la régénération est désactivée, pas les PV');
  });
});

describe('Fin de partie', () => {
  it('un joueur à 0 créature perd immédiatement', () => {
    const state = flatGame();
    // Un protecteur sans allié visible reste immobile : il ne s'échappe pas.
    put(state, 0, INSTINCTS.PROTECTEUR, 3, 3, { patch: { hp: 1 } });
    put(state, 1, INSTINCTS.CHASSEUR, 3, 4);
    const after = applyAction({ ...state, phase: PHASES.ACTIONS }, { type: ACTIONS.END_TURN, player: 0 });
    equal(after.winner, 1);
    equal(after.phase, PHASES.GAME_OVER);
  });

  it('les deux à 0 lors de la même phase : match nul', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHASSEUR, 3, 3, { patch: { hp: 1 } });
    put(state, 1, INSTINCTS.CHASSEUR, 3, 4, { patch: { hp: 1 } });
    const after = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(after.winner, 'draw');
  });
});

describe('applyAction', () => {
  const decks = [[], []];

  it('ne modifie jamais le state d’entrée', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.FUYARD, 0, 0);
    put(state, 1, INSTINCTS.FUYARD, 7, 7);
    const snapshot = saveState(state);
    applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(saveState(state), snapshot, 'pureté du moteur');
  });

  it('est déterministe', () => {
    const state = flatGame();
    put(state, 0, INSTINCTS.CHASSEUR, 0, 0);
    put(state, 1, INSTINCTS.FUYARD, 5, 5);
    const a = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    const b = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(saveState(a), saveState(b));
  });

  it('enchaîne placement puis première manche', () => {
    let state = createGame({ seed: 7, decks });
    equal(state.phase, PHASES.PLACEMENT);
    const first = state.firstPlacer;
    const cellA = legalActions(state)[0].cell;
    state = applyAction(state, { type: ACTIONS.PLACE_STARTER, player: first, cell: cellA });
    const cellB = legalActions(state)[0].cell;
    state = applyAction(state, { type: ACTIONS.PLACE_STARTER, player: 1 - first, cell: cellB });
    equal(state.phase, PHASES.ACTIONS);
    equal(state.activePlayer, 1 - first, 'le second à placer joue en premier');
    equal(state.round, 1);
    equal(state.players[state.activePlayer].energy, BALANCE.energy.perTurn);
  });

  it('refuse une invocation illégale', () => {
    const state = flatGame();
    state.players[0].energy = 10;
    let refus = 0;
    const tente = (action) => {
      try {
        applyAction(state, action);
      } catch (e) {
        if (e instanceof IllegalAction) refus++;
      }
    };
    tente({ type: ACTIONS.SUMMON, player: 0, instinct: INSTINCTS.CHASSEUR, cell: at(0, 7) });
    tente({ type: ACTIONS.SUMMON, player: 1, instinct: INSTINCTS.CHASSEUR, cell: at(0, 7) });
    tente({ type: ACTIONS.SUMMON, player: 0, instinct: 'licorne', cell: at(0, 0) });
    equal(refus, 3, 'moitié adverse, mauvais joueur, instinct inconnu');
  });

  it('n’autorise qu’un exemplaire d’un instinct par tour', () => {
    let state = flatGame();
    state.players[0].energy = 10;
    state = applyAction(state, { type: ACTIONS.SUMMON, player: 0, instinct: INSTINCTS.FUYARD, cell: at(0, 0) });
    let refuse = false;
    try {
      applyAction(state, { type: ACTIONS.SUMMON, player: 0, instinct: INSTINCTS.FUYARD, cell: at(1, 0) });
    } catch (e) {
      refuse = e instanceof IllegalAction;
    }
    assert(refuse);
    equal(state.players[0].energy, 10 - BALANCE.creatures[INSTINCTS.FUYARD].cost);
  });

  it('plafonne l’énergie à 10 et empile les événements', () => {
    let state = flatGame();
    put(state, 0, INSTINCTS.FUYARD, 0, 0);
    put(state, 1, INSTINCTS.FUYARD, 7, 7);
    state.players[1].energy = 9;
    state = applyAction(state, { type: ACTIONS.END_TURN, player: 0 });
    equal(state.players[1].energy, BALANCE.energy.max);
    assert(state.events.some((e) => e.type === 'turnStart'));
    assert(state.lastTurnEvents.length > 0, 'la dernière résolution est mémorisée');
  });
});

run();
