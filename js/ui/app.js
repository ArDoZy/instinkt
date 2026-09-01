/**
 * Contrôleur de l'application : enchaînement des écrans, ciblage, chrono,
 * passage hot-seat, sauvegarde locale.
 *
 * Toute décision de jeu passe par `applyAction` ; cette couche ne fait que
 * traduire des clics en actions et rejouer les événements renvoyés.
 */

import {
  ACTIONS,
  BALANCE,
  CARDS_BY_ID,
  IllegalAction,
  PHASES,
  applyAction,
  cloneState,
  createGame,
  creatureAt,
  legalTargets,
  loadState,
  playerToPlace,
  randomSeed,
  saveState,
  squareCells,
} from '../engine/index.js';
import { createAnimator } from './animator.js';
import { createCardAnimator } from './card-animator.js';
import { createGameScreen } from './game-screen.js';
import { allVisionsPreview, cardPreview, creaturePreview, summonPreview } from './preview.js';
import { deckScreen, gameOverScreen, homeScreen, passScreen, placementBanner, rulesScreen } from './screens.js';
import { el, qs } from './dom.js';

const SAVE_KEY = 'instynkt:sauvegarde:v1';

export function createApp(root) {
  const couches = {
    ecran: el('div', { class: 'couche-ecran' }),
    overlay: el('div', { class: 'couche-overlay' }),
    banniere: el('div', { class: 'couche-banniere' }),
  };
  root.append(couches.ecran, couches.banniere, couches.overlay);

  /** @type {object|null} */
  let state = null;
  let gameScreen = null;
  let animator = null;
  let decks = [null, null];
  let startedAt = 0;
  let chrono = null;
  /** Instantané d'avant la dernière résolution, pour le bouton « rejouer ». */
  let replay = null;
  /** Fin de tour réclamée pendant une animation : elle part dès qu'elle finit. */
  let finDeTourEnAttente = false;

  const ui = {
    selectedId: null,
    pendingCard: null,
    pendingCardStep: null,
    pendingTarget: null,
    pendingSummon: null,
    secondsLeft: BALANCE.turn.seconds,
    debug: false,
    busy: false,
  };

  // -------------------------------------------------------------------------
  // Sauvegarde
  // -------------------------------------------------------------------------

  const hasSave = () => {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  };

  function persist() {
    if (!state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ state: saveState(state), startedAt }));
    } catch {
      /* Mode privé ou quota plein : la partie continue sans sauvegarde. */
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignoré */
    }
  }

  // -------------------------------------------------------------------------
  // Écrans
  // -------------------------------------------------------------------------

  function showHome() {
    stopChrono();
    couches.overlay.replaceChildren();
    couches.banniere.replaceChildren();
    gameScreen = null;
    couches.ecran.replaceChildren(
      homeScreen({
        onStart: startDeckbuilding,
        onResume: resume,
        onRules: showRules,
        hasSave: hasSave(),
      })
    );
  }

  const showRules = () => couches.ecran.replaceChildren(rulesScreen({ onBack: showHome }));

  function startDeckbuilding() {
    decks = [null, null];
    askDeck(0);
  }

  function askDeck(player) {
    couches.ecran.replaceChildren(
      deckScreen({
        player,
        onValidate: (deck) => {
          decks[player] = deck;
          if (player === 0) askDeck(1);
          else startGame();
        },
      })
    );
  }

  function startGame(seed = randomSeed()) {
    state = createGame({ seed, decks, names: ['Joueur 1', 'Joueur 2'] });
    startedAt = Date.now();
    replay = null;
    clearSave();
    openGameScreen();
    beginPlacement();
  }

  function resume() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      state = loadState(raw.state);
      startedAt = raw.startedAt ?? Date.now();
    } catch {
      clearSave();
      return showHome();
    }
    replay = null;
    openGameScreen();
    if (state.phase === PHASES.PLACEMENT) beginPlacement();
    else if (state.phase === PHASES.GAME_OVER) showGameOver();
    else askPass();
  }

  function openGameScreen() {
    couches.ecran.replaceChildren();
    couches.overlay.replaceChildren();
    gameScreen = createGameScreen(couches.ecran, handlers);
    const cards = createCardAnimator({
      layer: gameScreen.coucheCartes,
      pile: gameScreen.pileEl,
      hand: gameScreen.handEl,
      boardView: gameScreen.boardView,
    });
    animator = createAnimator(gameScreen.boardView, {
      cards,
      onEnergy: ({ player, delta }) => gameScreen.animateEnergy(player, delta),
    });
    render();
  }

  // -------------------------------------------------------------------------
  // Placement puis manches
  // -------------------------------------------------------------------------

  function beginPlacement() {
    const player = playerToPlace(state);
    if (player === null) return askPass();
    couches.banniere.replaceChildren(placementBanner(player));
    render();
  }

  /** Écran de passage : le chrono ne démarre qu'après validation (§6.11). */
  function askPass() {
    stopChrono();
    couches.banniere.replaceChildren();
    couches.overlay.replaceChildren(
      passScreen({
        player: state.activePlayer,
        round: state.round,
        state,
        onContinue: () => {
          couches.overlay.replaceChildren();
          startChrono();
          render();
        },
      })
    );
    render();
  }

  function startChrono() {
    stopChrono();
    ui.secondsLeft = BALANCE.turn.seconds;
    gameScreen?.setTimer(ui.secondsLeft, false);
    chrono = setInterval(() => {
      ui.secondsLeft -= 1;
      gameScreen?.setTimer(ui.secondsLeft, ui.secondsLeft <= 5);
      // À 0 seconde, le tour passe : les actions déjà validées sont conservées.
      if (ui.secondsLeft <= 0) endTurn();
    }, 1000);
  }

  function stopChrono() {
    if (chrono) clearInterval(chrono);
    chrono = null;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /** Applique une action et rejoue ses événements. */
  async function dispatch(action, { snapshot = false } = {}) {
    if (ui.busy) return;
    let next;
    try {
      next = applyAction(state, action);
    } catch (error) {
      if (error instanceof IllegalAction) return flash(error.message);
      throw error;
    }

    const before = snapshot ? cloneState(state) : null;
    const events = next.events;
    state = next;
    resetTargeting();

    ui.busy = true;
    render();
    await animator.play(events, state);
    ui.busy = false;

    if (snapshot) replay = { before, events };
    persist();

    if (finDeTourEnAttente && !snapshot && state.winner === null) {
      finDeTourEnAttente = false;
      return endTurn();
    }
    finDeTourEnAttente = false;

    // Le placement enchaîne sur le joueur suivant, puis sur la première manche.
    if (action.type === ACTIONS.PLACE_STARTER) return beginPlacement();
    if (state.winner !== null) return showGameOver();
    if (snapshot) return askPass();
    render();
  }

  function endTurn() {
    // Le chrono peut expirer pendant une animation : la fin de tour attend
    // alors qu'elle se termine plutôt que d'être perdue.
    if (ui.busy) {
      finDeTourEnAttente = true;
      return;
    }
    stopChrono();
    dispatch({ type: ACTIONS.END_TURN, player: state.activePlayer }, { snapshot: true });
  }

  function resetTargeting() {
    ui.pendingCard = null;
    ui.pendingCardStep = null;
    ui.pendingTarget = null;
    ui.pendingSummon = null;
  }

  function flash(message) {
    couches.banniere.replaceChildren(el('div', { class: 'banniere refus' }, message));
    setTimeout(() => {
      if (qs('.refus', couches.banniere)) couches.banniere.replaceChildren();
    }, 2200);
  }

  // -------------------------------------------------------------------------
  // Ciblage
  // -------------------------------------------------------------------------

  function onCellClick(cell) {
    if (ui.busy || !state) return;

    if (state.phase === PHASES.PLACEMENT) {
      const player = playerToPlace(state);
      if (player !== null) dispatch({ type: ACTIONS.PLACE_STARTER, player, cell });
      return;
    }
    if (couches.overlay.childElementCount > 0) return;

    if (ui.pendingSummon) {
      dispatch({ type: ACTIONS.SUMMON, player: state.activePlayer, instinct: ui.pendingSummon, cell });
      return;
    }
    if (ui.pendingCard) return targetWithCell(cell);

    const creature = creatureAt(state, cell);
    ui.selectedId = creature && creature.id !== ui.selectedId ? creature.id : null;
    render();
  }

  /** Traduit un clic sur une case en cible de carte, selon le mode de ciblage. */
  function targetWithCell(cell) {
    const card = CARDS_BY_ID[ui.pendingCard];
    const creature = creatureAt(state, cell);
    const player = state.activePlayer;

    if (card.target === 'enemy+ally') {
      if (!creature) return;
      if (ui.pendingCardStep === 'ally') {
        return play({ creatureId: ui.pendingTarget, allyId: creature.id });
      }
      ui.pendingTarget = creature.id;
      ui.pendingCardStep = 'ally';
      flash('Désignez maintenant la créature alliée à faire traquer.');
      return render();
    }

    if (card.target === 'ally' || card.target === 'enemy') {
      if (creature) play({ creatureId: creature.id });
      return;
    }
    if (card.target === 'cell' || card.target === 'area2x2') return play({ cell });
    if (card.target.startsWith('region:')) return play({ regionId: state.regionOfCell[cell] });
  }

  function play(target) {
    dispatch({ type: ACTIONS.PLAY_CARD, player: state.activePlayer, cardId: ui.pendingCard, target });
  }

  function onCardClick(cardId) {
    if (ui.busy) return;
    const card = CARDS_BY_ID[cardId];
    if (ui.pendingCard === cardId) return (resetTargeting(), render());

    resetTargeting();
    ui.pendingCard = cardId;
    ui.pendingCardStep = card.target === 'enemy+ally' ? 'enemy' : null;

    // Une carte globale n'a pas de cible à désigner : elle part immédiatement.
    if (card.target === 'global') {
      const targets = legalTargets(state, state.activePlayer, cardId);
      if (targets.length) return play(targets[0]);
      resetTargeting();
      return flash('Aucune cible légale sur le plateau.');
    }
    render();
  }

  function onSummonClick(instinct) {
    if (ui.busy) return;
    const encore = ui.pendingSummon === instinct;
    resetTargeting();
    ui.pendingSummon = encore ? null : instinct;
    render();
  }

  // -------------------------------------------------------------------------
  // Survols et prévisualisations
  // -------------------------------------------------------------------------

  function onCellHover(cell) {
    if (!state || !gameScreen) return;

    if (state.phase === PHASES.PLACEMENT || ui.pendingSummon) return applyRestingPreview();
    if (ui.pendingCard) return previewCard(ui.pendingCard, cell);

    if (cell === null) return applyRestingPreview();
    const creature = creatureAt(state, cell);
    if (creature) return gameScreen.boardView.applyPreview(creaturePreview(state, creature));
    applyRestingPreview();
  }

  /**
   * Aperçu affiché quand rien n'est survolé. C'est le point d'entrée unique :
   * tout re-rendu le rappelle, donc un ciblage en cours n'est jamais effacé.
   */
  function applyRestingPreview() {
    if (!state || !gameScreen) return;

    if (state.phase === PHASES.PLACEMENT) {
      const player = playerToPlace(state);
      return gameScreen.boardView.applyPreview(player === null ? {} : summonPreview(state, player));
    }
    if (ui.pendingSummon) {
      return gameScreen.boardView.applyPreview(summonPreview(state, state.activePlayer));
    }
    if (ui.pendingCard) return previewCard(ui.pendingCard);
    if (ui.debug) return gameScreen.boardView.applyPreview(allVisionsPreview(state));

    const pinned = ui.selectedId ? state.creatures.find((c) => c.id === ui.selectedId) : null;
    gameScreen.boardView.applyPreview(pinned ? creaturePreview(state, pinned) : {});
  }

  function previewCard(cardId, hovered = null) {
    const card = CARDS_BY_ID[cardId];
    const preview = cardPreview(state, state.activePlayer, cardId);
    if (card.target === 'area2x2' && hovered !== null) {
      const legal = new Set(preview.targets.map((t) => t.cell));
      if (legal.has(hovered)) preview.marks.zone = squareCells(hovered);
    }
    if (card.target.startsWith('region:') && hovered !== null) {
      const region = state.regions[state.regionOfCell[hovered]];
      const legal = new Set(preview.targets.map((t) => t.regionId));
      if (legal.has(region.id)) preview.marks.zone = region.cells;
    }
    gameScreen.boardView.applyPreview(preview);
  }

  // -------------------------------------------------------------------------

  function showGameOver() {
    stopChrono();
    clearSave();
    couches.overlay.replaceChildren(
      gameOverScreen({
        state,
        durationMs: Date.now() - startedAt,
        onReplay: startDeckbuilding,
        onHome: showHome,
      })
    );
  }

  async function replayLastTurn() {
    if (!replay || ui.busy) return;
    ui.busy = true;
    gameScreen.boardView.render(replay.before);
    await animator.play(replay.events, state);
    ui.busy = false;
    render();
  }

  const handlers = {
    onCellClick,
    onCellHover,
    onCardClick,
    onCardHover: (cardId) => {
      if (ui.pendingCard || ui.pendingSummon) return;
      if (cardId) previewCard(cardId);
      else applyRestingPreview();
    },
    onSummonClick,
    onSummonHover: (instinct) => {
      if (ui.pendingCard || ui.pendingSummon) return;
      if (instinct) gameScreen.boardView.applyPreview(summonPreview(state, state.activePlayer));
      else applyRestingPreview();
    },
    onDiscard: (cardId) => dispatch({ type: ACTIONS.DISCARD, player: state.activePlayer, cardId }),
    onEndTurn: endTurn,
    onCancel: () => (resetTargeting(), applyRestingPreview(), render()),
    onReplay: replayLastTurn,
    onDebugToggle: (event) => {
      ui.debug = event.target.checked;
      applyRestingPreview();
      render();
    },
    onSkipTurn: endTurn,
  };

  function render() {
    if (!gameScreen || !state) return;
    gameScreen.render(state, ui);
    applyRestingPreview();
  }

  showHome();
  return { showHome };
}
