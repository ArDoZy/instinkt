/**
 * Tests de l'étape 1 : PRNG, génération de plateau, régions, state.
 * Lancer avec `npm test` (ou `node tests/engine.test.mjs`).
 */

import { describe, it, assert, equal, deepEqual, run } from './harness.mjs';
import {
  BALANCE,
  BIOMES,
  CARDS,
  INSTINCT_LIST,
  createRng,
  rngFloat,
  rngInt,
  rngShuffle,
  generateBoard,
  computeRegions,
  validateBoard,
  isFullyConnected,
  withBiome,
  createGame,
  saveState,
  loadState,
  cloneState,
  refreshRegions,
  summonableCells,
  isCellFree,
  ALL_CELLS,
  W,
  H,
  idx,
  dist,
  adjacent,
  neighbors4,
  neighbors8,
  halfOfCell,
  renderBiomes,
  renderRegions,
} from '../js/engine/index.js';
import { isPassableCell } from '../js/engine/board.js';

const SAMPLE_SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 7919);

describe('PRNG', () => {
  it('est déterministe pour une même graine', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) equal(rngFloat(a), rngFloat(b), `tirage ${i}`);
  });

  it('diverge pour des graines différentes', () => {
    const a = createRng(42);
    const b = createRng(43);
    const seqA = Array.from({ length: 20 }, () => rngFloat(a));
    const seqB = Array.from({ length: 20 }, () => rngFloat(b));
    assert(seqA.join() !== seqB.join(), 'deux graines produisent la même suite');
  });

  it('reste dans [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 5000; i++) {
      const v = rngFloat(rng);
      assert(v >= 0 && v < 1, `valeur hors bornes: ${v}`);
    }
  });

  it('rngInt couvre toutes les valeurs sans déborder', () => {
    const rng = createRng(9);
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const v = rngInt(rng, 6);
      assert(Number.isInteger(v) && v >= 0 && v < 6, `valeur invalide: ${v}`);
      seen.add(v);
    }
    equal(seen.size, 6, 'toutes les faces devraient sortir');
  });

  it('rngShuffle est une permutation déterministe', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = rngShuffle(createRng(123), src.slice());
    const s2 = rngShuffle(createRng(123), src.slice());
    deepEqual(s1, s2, 'même graine, même permutation');
    deepEqual(s1.slice().sort((a, b) => a - b), src, 'permutation incomplète');
  });

  it("l'état du PRNG est sérialisable en JSON", () => {
    const rng = createRng(555);
    for (let i = 0; i < 10; i++) rngFloat(rng);
    const restored = JSON.parse(JSON.stringify(rng));
    equal(rngFloat(restored), rngFloat(cloneState(rng)), 'reprise après sérialisation');
  });
});

describe('Géométrie', () => {
  it('index et coordonnées sont réciproques', () => {
    for (const i of ALL_CELLS) equal(idx(i % W, (i / W) | 0), i);
  });

  it('la distance est celle de Chebyshev', () => {
    equal(dist(idx(0, 0), idx(3, 1)), 3);
    equal(dist(idx(2, 2), idx(4, 5)), 3);
    equal(dist(idx(5, 5), idx(5, 5)), 0);
    assert(adjacent(idx(1, 1), idx(2, 2)), 'la diagonale est adjacente');
    assert(!adjacent(idx(1, 1), idx(1, 1)), 'une case n’est pas adjacente à elle-même');
  });

  it('les voisinages restent dans la grille', () => {
    equal(neighbors4(idx(0, 0)).length, 2);
    equal(neighbors8(idx(0, 0)).length, 3);
    equal(neighbors8(idx(3, 3)).length, 8);
    equal(neighbors8(idx(7, 7)).length, 3);
  });

  it('les moitiés de plateau sont 0-3 et 4-7', () => {
    equal(halfOfCell(idx(0, 3)), 0);
    equal(halfOfCell(idx(0, 4)), 1);
    equal(ALL_CELLS.filter((c) => halfOfCell(c) === 0).length, 32);
  });
});

describe('Génération de plateau', () => {
  it('produit toujours un plateau valide', () => {
    for (const seed of SAMPLE_SEEDS) {
      const { board } = generateBoard(createRng(seed));
      const v = validateBoard(board);
      assert(v.ok, `graine ${seed} invalide: ${v.reason}`);
      equal(board.tiles.length, W * H, `graine ${seed}`);
      assert(board.tiles.every((t) => Object.values(BIOMES).includes(t)), `biome inconnu (graine ${seed})`);
    }
  });

  it('respecte le nombre de régions visé (4 à 7)', () => {
    for (const seed of SAMPLE_SEEDS) {
      const { board } = generateBoard(createRng(seed));
      const { regions } = computeRegions(board);
      assert(
        regions.length >= BALANCE.board.minRegions && regions.length <= BALANCE.board.maxRegions,
        `graine ${seed}: ${regions.length} régions`
      );
    }
  });

  it('laisse au moins 8 cases libres par moitié', () => {
    for (const seed of SAMPLE_SEEDS) {
      const { board } = generateBoard(createRng(seed));
      const halves = [0, 0];
      for (const c of ALL_CELLS) if (isPassableCell(board, c)) halves[halfOfCell(c)]++;
      assert(halves[0] >= 8 && halves[1] >= 8, `graine ${seed}: ${halves.join('/')}`);
    }
  });

  it('garde le plateau connexe malgré les montagnes', () => {
    for (const seed of SAMPLE_SEEDS) {
      const { board } = generateBoard(createRng(seed));
      assert(isFullyConnected(board), `graine ${seed}: plateau coupé en deux`);
    }
  });

  it('plafonne la part de montagne', () => {
    const cap = BALANCE.board.maxMountainRatio * W * H;
    for (const seed of SAMPLE_SEEDS) {
      const { board } = generateBoard(createRng(seed));
      const mountains = board.tiles.filter((t) => t === BIOMES.MONTAGNE).length;
      assert(mountains <= cap, `graine ${seed}: ${mountains} montagnes (max ${cap})`);
    }
  });

  it('évite les plateaux monochromes', () => {
    const cap = BALANCE.board.maxRegionRatio * W * H;
    for (const seed of SAMPLE_SEEDS) {
      const { board } = generateBoard(createRng(seed));
      const { regions } = computeRegions(board);
      const biggest = Math.max(...regions.map((r) => r.cells.length));
      assert(biggest <= cap, `graine ${seed}: région de ${biggest} cases (max ${cap})`);
      assert(
        new Set(board.tiles).size >= BALANCE.board.minDistinctBiomes,
        `graine ${seed}: pas assez de biomes distincts`
      );
    }
  });

  it('est reproductible à graine égale', () => {
    const a = generateBoard(createRng(20260901)).board;
    const b = generateBoard(createRng(20260901)).board;
    deepEqual(a.tiles, b.tiles);
  });

  it('détecte un plateau coupé en deux', () => {
    const wall = { width: W, height: H, tiles: new Array(W * H).fill(BIOMES.PLAINE) };
    for (let x = 0; x < W; x++) wall.tiles[idx(x, 3)] = BIOMES.MONTAGNE;
    assert(!isFullyConnected(wall), 'un mur complet devrait déconnecter');
    assert(!validateBoard(wall).ok);
  });
});

describe('Régions de biome', () => {
  const flat = { width: W, height: H, tiles: new Array(W * H).fill(BIOMES.PLAINE) };

  it('un plateau uniforme est une seule région', () => {
    const { regions } = computeRegions(flat);
    equal(regions.length, 1);
    equal(regions[0].cells.length, W * H);
    deepEqual(regions[0].fringe, []);
  });

  it('deux taches du même biome séparées font deux régions', () => {
    const board = withBiome(flat, [idx(0, 0), idx(7, 7)], BIOMES.FORET);
    const { regions } = computeRegions(board);
    const forests = regions.filter((r) => r.biome === BIOMES.FORET);
    equal(forests.length, 2, 'deux taches distinctes');
    equal(forests[0].cells.length, 1);
  });

  it('la contiguïté est en 4 directions, pas en diagonale', () => {
    const board = withBiome(flat, [idx(2, 2), idx(3, 3)], BIOMES.DESERT);
    const { regions } = computeRegions(board);
    equal(regions.filter((r) => r.biome === BIOMES.DESERT).length, 2, 'la diagonale ne relie pas');
  });

  it('le halo est en 8 directions et exclut la région', () => {
    const board = withBiome(flat, [idx(4, 4)], BIOMES.JUNGLE);
    const { regions } = computeRegions(board);
    const jungle = regions.find((r) => r.biome === BIOMES.JUNGLE);
    equal(jungle.fringe.length, 8);
    assert(!jungle.fringe.includes(idx(4, 4)));
  });

  it('couvre chaque case exactement une fois', () => {
    for (const seed of SAMPLE_SEEDS.slice(0, 50)) {
      const { board } = generateBoard(createRng(seed));
      const { regions, regionOfCell } = computeRegions(board);
      const total = regions.reduce((n, r) => n + r.cells.length, 0);
      equal(total, W * H, `graine ${seed}`);
      assert(regionOfCell.every((r) => r >= 0 && r < regions.length), `graine ${seed}`);
      for (const r of regions) {
        assert(r.cells.every((c) => board.tiles[c] === r.biome), 'biome hétérogène dans une région');
        assert(r.cells.every((c) => regionOfCell[c] === r.id), 'index de région incohérent');
      }
    }
  });
});

describe('State', () => {
  const deckA = CARDS.slice(0, 6).map((c) => c.id);
  const deckB = CARDS.slice(6, 12).map((c) => c.id);
  const newGame = (seed = 4242) => createGame({ seed, decks: [deckA, deckB] });

  it('crée une partie complète et déterministe', () => {
    const g1 = newGame();
    const g2 = newGame();
    deepEqual(g1, g2, 'même graine, même partie');
    equal(g1.creatures.length, 0);
    equal(g1.round, 0);
    equal(g1.phase, 'placement');
    equal(g1.winner, null);
  });

  it('mélange la pioche sans perdre de carte', () => {
    const g = newGame();
    equal(g.players[0].draw.length, 6);
    deepEqual(g.players[0].draw.slice().sort(), deckA.slice().sort());
    deepEqual(g.players[1].draw.slice().sort(), deckB.slice().sort());
  });

  it('fait jouer le Joueur 2 en premier (§4)', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const g = createGame({ seed, decks: [deckA, deckB] });
      equal(g.activePlayer, 1 - g.firstPlacer, `graine ${seed}`);
    }
  });

  it('survit à un aller-retour JSON', () => {
    const g = newGame();
    const restored = loadState(saveState(g));
    deepEqual(restored, g);
  });

  it('refuse une version de state inconnue', () => {
    const g = newGame();
    g.version = 999;
    let threw = false;
    try {
      loadState(saveState(g));
    } catch {
      threw = true;
    }
    assert(threw, 'une version inconnue devrait lever');
  });

  it('cloneState isole les modifications', () => {
    const g = newGame();
    const copy = cloneState(g);
    copy.board.tiles[0] = BIOMES.MONTAGNE;
    copy.players[0].energy = 99;
    assert(g.board.tiles[0] !== BIOMES.MONTAGNE || copy.players[0].energy !== g.players[0].energy);
    equal(g.players[0].energy, BALANCE.energy.start);
  });

  it('ne propose que des cases libres de sa propre moitié à l’invocation', () => {
    const g = newGame();
    for (const player of [0, 1]) {
      const cells = summonableCells(g, player);
      assert(cells.length >= BALANCE.board.minFreeCellsPerHalf, 'trop peu de cases');
      for (const c of cells) {
        equal(halfOfCell(c), player, 'case hors de sa moitié');
        assert(isCellFree(g, c), 'case non libre proposée');
        assert(g.board.tiles[c] !== BIOMES.MONTAGNE, 'montagne proposée');
      }
    }
  });

  it('recalcule les régions après un changement de terrain', () => {
    const g = newGame();
    const before = g.regions.length;
    g.board = withBiome(g.board, ALL_CELLS, BIOMES.PLAINE);
    refreshRegions(g);
    equal(g.regions.length, 1, `avant: ${before} régions`);
    assert(g.regionOfCell.every((r) => r === 0));
  });
});

describe('Tables d’équilibrage', () => {
  it('décrit les 6 instincts', () => {
    for (const instinct of INSTINCT_LIST) {
      const s = BALANCE.creatures[instinct];
      assert(s, `stats manquantes pour ${instinct}`);
      assert(s.cost >= 1 && s.hp > 0 && s.speed >= 1, `stats invalides pour ${instinct}`);
    }
  });

  it('contient 16 cartes aux identifiants uniques', () => {
    equal(CARDS.length, 16);
    equal(new Set(CARDS.map((c) => c.id)).size, 16);
    for (const c of CARDS) {
      assert(c.cost >= 1 && c.cost <= BALANCE.energy.max, `coût invalide: ${c.id}`);
      assert(typeof c.target === 'string' && c.text.length > 0, `carte incomplète: ${c.id}`);
    }
  });

  it('un deck légal fait 6 cartes sans doublon', () => {
    const deck = CARDS.slice(0, BALANCE.deck.size).map((c) => c.id);
    equal(deck.length, BALANCE.deck.size);
    equal(new Set(deck).size, BALANCE.deck.size);
  });
});

describe('Rendu texte (mise au point)', () => {
  it('rend une grille lisible sans toucher au DOM', () => {
    const { board } = generateBoard(createRng(1));
    const out = renderBiomes(board);
    assert(out.split('\n').length === H + 2, 'hauteur inattendue');
    const g = createGame({ seed: 1, decks: [[], []] });
    assert(renderRegions(g).includes('0'), 'aucune région rendue');
  });
});

run();
