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
import { choisir } from './ai.mjs';

const games = Number(process.argv[2] ?? 200);
const verbose = process.argv.includes('--verbose');
/**
 * Deux modèles de joueur. Le mode aléatoire est un test de robustesse : il
 * vérifie que le moteur encaisse n'importe quelle suite d'actions légales. Le
 * mode orienté (--oriente) est un modèle grossier de vrai joueur, qui pousse
 * vers le Roi adverse : c'est lui qui dit quelque chose sur le rythme réel.
 */
const oriente = process.argv.includes('--oriente');

const MAX_ROUNDS = 160;

function randomDeck(rng) {
  return rngShuffle(rng, CARDS.map((c) => c.id)).slice(0, BALANCE.deck.size);
}

function playGame(seed) {
  const rng = createRng(seed);
  let state = createGame({ seed, decks: [randomDeck(rng), randomDeck(rng)] });

  while (state.winner === null && state.round <= MAX_ROUNDS) {
    const actions = legalActions(state);
    if (actions.length === 0) break;

    let action;
    if (oriente) {
      action = choisir(state, actions, rng);
    } else {
      // Elle finit son tour une fois sur trois, sinon agit au hasard.
      const others = actions.filter((a) => a.type !== ACTIONS.END_TURN);
      action = others.length && rngInt(rng, 3) > 0 ? others[rngInt(rng, others.length)] : actions[0];
    }
    state = applyAction(state, action);
  }
  return state;
}

let wins = [0, 0];
let draws = 0;
let unfinished = 0;
let rounds = 0;
let creatures = 0;
/** Combien de parties se concluent avant que la mort subite ne commence. */
let avantMortSubite = 0;
const paliers = new Map();

for (let seed = 1; seed <= games; seed++) {
  const state = playGame(seed);
  rounds += state.round;
  creatures += state.creatures.length;
  if (state.round < BALANCE.suddenDeath.startRound) avantMortSubite++;
  const palier = Math.floor(state.round / 10) * 10;
  paliers.set(palier, (paliers.get(palier) ?? 0) + 1);
  if (state.winner === 'draw') draws++;
  else if (state.winner === null) unfinished++;
  else wins[state.winner]++;

  if (verbose && seed === 1) {
    console.log(renderBoard(state));
    console.log(state.log.slice(-12).map((l) => `  ${l.text}`).join('\n'));
  }
}

console.log(`${games} parties simulées (${oriente ? 'joueur orienté vers le Roi adverse' : 'actions légales aléatoires'})`);
console.log(`  Joueur 1 : ${wins[0]}   Joueur 2 : ${wins[1]}   Nuls : ${draws}   Inachevées : ${unfinished}`);
console.log(`  Manches moyennes : ${(rounds / games).toFixed(1)}`);
console.log(`  Créatures survivantes en moyenne : ${(creatures / games).toFixed(1)}`);
console.log(`  Terminées avant la mort subite (manche ${BALANCE.suddenDeath.startRound}) : ${((avantMortSubite / games) * 100).toFixed(0)} %`);
console.log('\n  Manche de fin');
for (const k of [...paliers.keys()].sort((a, b) => a - b)) {
  const part = (paliers.get(k) / games) * 100;
  console.log(`    ${String(k).padStart(3)}+ ${'█'.repeat(Math.round(part / 2)).padEnd(50)} ${part.toFixed(0)} %`);
}
