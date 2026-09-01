/**
 * Simulation de parties complètes par actions légales aléatoires.
 * `node tools/simulate.mjs [parties] [--verbose]`
 *
 * Sert de test d'intégration (le moteur ne doit jamais planter ni boucler) et
 * de première mesure d'équilibrage.
 */

import {
  ACTIONS,
  BALANCE,
  CARDS,
  applyAction,
  createGame,
  createRng,
  legalActions,
  renderBoard,
  rngInt,
  rngShuffle,
} from '../js/engine/index.js';

const games = Number(process.argv[2] ?? 200);
const verbose = process.argv.includes('--verbose');

const MAX_ROUNDS = 120;

function randomDeck(rng) {
  return rngShuffle(rng, CARDS.map((c) => c.id)).slice(0, BALANCE.deck.size);
}

function playGame(seed) {
  const rng = createRng(seed);
  let state = createGame({ seed, decks: [randomDeck(rng), randomDeck(rng)] });

  while (state.winner === null && state.round <= MAX_ROUNDS) {
    const actions = legalActions(state);
    if (actions.length === 0) break;

    // Une IA de test : elle finit son tour une fois sur trois, sinon agit.
    const others = actions.filter((a) => a.type !== ACTIONS.END_TURN);
    const action = others.length && rngInt(rng, 3) > 0 ? others[rngInt(rng, others.length)] : actions[0];
    state = applyAction(state, action);
  }
  return state;
}

let wins = [0, 0];
let draws = 0;
let unfinished = 0;
let rounds = 0;
let creatures = 0;

for (let seed = 1; seed <= games; seed++) {
  const state = playGame(seed);
  rounds += state.round;
  creatures += state.creatures.length;
  if (state.winner === 'draw') draws++;
  else if (state.winner === null) unfinished++;
  else wins[state.winner]++;

  if (verbose && seed === 1) {
    console.log(renderBoard(state));
    console.log(state.log.slice(-12).map((l) => `  ${l.text}`).join('\n'));
  }
}

console.log(`${games} parties simulées (actions légales aléatoires)`);
console.log(`  Joueur 1 : ${wins[0]}   Joueur 2 : ${wins[1]}   Nuls : ${draws}   Inachevées : ${unfinished}`);
console.log(`  Manches moyennes : ${(rounds / games).toFixed(1)}`);
console.log(`  Créatures survivantes en moyenne : ${(creatures / games).toFixed(1)}`);
