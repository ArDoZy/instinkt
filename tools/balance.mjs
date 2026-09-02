/**
 * Passe d'équilibrage : matrice instinct contre instinct.
 *
 * Chaque joueur n'invoque qu'un seul instinct, sans carte : le résultat isole
 * la valeur intrinsèque de chaque créature. `node tools/balance.mjs [parties]`
 */

import {
  ACTIONS,
  BALANCE,
  INSTINCT_LIST,
  applyAction,
  createGame,
  createRng,
  legalActions,
  rngInt,
} from '../js/engine/index.js';

const parParcelle = Number(process.argv[2] ?? 40);
const MAX_ROUNDS = 120;

/** Joue une partie où le joueur i n'invoque que `instincts[i]`. */
function duel(instincts, seed) {
  const rng = createRng(seed);
  let state = createGame({ seed, decks: [[], []] });

  while (state.winner === null && state.round <= MAX_ROUNDS) {
    const actions = legalActions(state);
    if (actions.length === 0) break;

    const placements = actions.filter((a) => a.type === ACTIONS.PLACE_STARTER);
    if (placements.length) {
      state = applyAction(state, placements[rngInt(rng, placements.length)]);
      continue;
    }

    const player = state.activePlayer;
    const invocations = actions.filter(
      (a) => a.type === ACTIONS.SUMMON && a.instinct === instincts[player]
    );
    if (invocations.length) {
      state = applyAction(state, invocations[rngInt(rng, invocations.length)]);
      continue;
    }
    state = applyAction(state, { type: ACTIONS.END_TURN, player });
  }
  return state;
}

const noms = INSTINCT_LIST;
const resultats = new Map();
let manches = 0;
let parties = 0;
let inachevees = 0;

for (const a of noms) {
  for (const b of noms) {
    let victoires = 0;
    let nuls = 0;
    for (let i = 0; i < parParcelle; i++) {
      const state = duel([a, b], 1 + i * 7919 + noms.indexOf(a) * 31 + noms.indexOf(b));
      manches += state.round;
      parties++;
      if (state.winner === 0) victoires++;
      else if (state.winner === 'draw') nuls++;
      else if (state.winner === null) inachevees++;
    }
    resultats.set(`${a}|${b}`, { victoires, nuls });
  }
}

const pad = (s, n) => String(s).padEnd(n);
const col = 13;

console.log(`Matrice des duels — ${parParcelle} parties par case, sans carte`);
console.log('Lecture : taux de victoire de la créature en ligne contre celle en colonne.\n');
console.log(pad('', col) + noms.map((n) => pad(n.slice(0, 11), col)).join(''));

const scores = new Map(noms.map((n) => [n, { v: 0, t: 0 }]));
for (const a of noms) {
  const ligne = [pad(a, col)];
  for (const b of noms) {
    const { victoires } = resultats.get(`${a}|${b}`);
    const taux = (victoires / parParcelle) * 100;
    ligne.push(pad(`${taux.toFixed(0)} %`, col));
    if (a !== b) {
      const s = scores.get(a);
      s.v += victoires;
      s.t += parParcelle;
    }
  }
  console.log(ligne.join(''));
}

console.log('\nTaux de victoire global (hors miroir), du plus fort au plus faible');
const classement = [...scores.entries()]
  .map(([nom, s]) => ({ nom, taux: (s.v / s.t) * 100, cout: BALANCE.creatures[nom].cost }))
  .sort((x, y) => y.taux - x.taux);
for (const { nom, taux, cout } of classement) {
  console.log(`  ${pad(nom, 14)}${pad(`${cout}⚡`, 5)}${'█'.repeat(Math.round(taux / 2)).padEnd(50)} ${taux.toFixed(1)} %`);
}
console.log(`\nManches moyennes : ${(manches / parties).toFixed(1)}   Parties inachevées : ${inachevees}`);
