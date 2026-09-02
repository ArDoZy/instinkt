/**
 * Modèle de joueur sommaire, partagé par le simulateur et les mesures
 * d'équilibrage : il pousse vers le Roi adverse plutôt que d'agir au hasard.
 */

import {
  ACTIONS,
  BALANCE,
  CARDS,
  INSTINCTS,
  applyAction,
  createGame,
  createRng,
  dist,
  H,
  W,
  legalActions,
  xOf,
  yOf,
  rngInt,
  rngShuffle,
} from '../js/engine/index.js';

/** Ordre de préférence d'invocation : d'abord ce qui menace le Roi. */
export const PRIORITE = [
  INSTINCTS.TUEUR_DE_ROI,
  INSTINCTS.CHASSEUR,
  INSTINCTS.PROTECTEUR,
  INSTINCTS.TERRITORIAL,
];

/**
 * Choisit une action. Le Roi se pose au fond de sa moitié — le plus loin
 * possible de l'adversaire — puis on invoque au plus près du Roi adverse.
 */
export function choisir(state, actions, rng) {
  const placements = actions.filter((a) => a.type === ACTIONS.PLACE_STARTER);
  if (placements.length) {
    const fond = placements[0].player === 0 ? 0 : H - 1;
    return placements.reduce((best, a) =>
      Math.abs(yOf(a.cell) - fond) < Math.abs(yOf(best.cell) - fond) ||
      (yOf(a.cell) === yOf(best.cell) && Math.abs(xOf(a.cell) - W / 2) < Math.abs(xOf(best.cell) - W / 2))
        ? a
        : best
    );
  }

  const player = state.activePlayer;
  const roiAdverse = state.creatures.find(
    (c) => c.hp > 0 && c.owner !== player && c.instinct === INSTINCTS.ROI
  );

  const defausse = actions.filter((a) => a.type === ACTIONS.DISCARD);
  if (defausse.length) return defausse[0];

  for (const instinct of PRIORITE) {
    const poses = actions.filter((a) => a.type === ACTIONS.SUMMON && a.instinct === instinct);
    if (!poses.length) continue;
    if (!roiAdverse) return poses[0];
    return poses.reduce((best, a) =>
      dist(a.cell, roiAdverse.cell) < dist(best.cell, roiAdverse.cell) ? a : best
    );
  }

  const cartes = actions.filter((a) => a.type === ACTIONS.PLAY_CARD);
  if (cartes.length && rngInt(rng, 2) === 0) return cartes[rngInt(rng, cartes.length)];

  return actions.find((a) => a.type === ACTIONS.END_TURN) ?? actions[0];
}

/** Joue `parties` parties complètes et renvoie une ligne de statistiques. */
export function jouer(parties = 150, maxRounds = 160) {
  let wins = [0, 0];
  let nuls = 0;
  let manches = 0;
  let avant = 0;

  for (let seed = 1; seed <= parties; seed++) {
    const rng = createRng(seed);
    const decks = [0, 1].map(() => rngShuffle(rng, CARDS.map((c) => c.id)).slice(0, BALANCE.deck.size));
    let state = createGame({ seed, decks });

    while (state.winner === null && state.round <= maxRounds) {
      const actions = legalActions(state);
      if (actions.length === 0) break;
      state = applyAction(state, choisir(state, actions, rng));
    }
    manches += state.round;
    if (state.round < BALANCE.suddenDeath.startRound) avant++;
    if (state.winner === 'draw') nuls++;
    else if (state.winner !== null) wins[state.winner]++;
  }

  const ligne =
    `${(manches / parties).toFixed(1).padStart(7)}  ` +
    `${String(wins[0]).padStart(3)}/${String(wins[1]).padStart(3)}/${String(nuls).padStart(3)}   ` +
    `${((avant / parties) * 100).toFixed(0).padStart(3)} %`;
  console.log(ligne);
  return { wins, nuls, manches: manches / parties, avant: avant / parties };
}
