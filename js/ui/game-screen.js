/**
 * Écran de partie : plateau au centre, inspecteur à droite, main et
 * invocations en bas, adversaire en haut (§7).
 *
 * Ce module ne fait que construire et mettre à jour le DOM ; toutes les
 * décisions passent par les gestionnaires fournis par app.js.
 */

import {
  BALANCE,
  BIOME_META,
  CARDS_BY_ID,
  INSTINCTS,
  creatureById,
  playableCards,
  stats,
  summonOptions,
} from '../engine/index.js';
import { ENERGY_ICON, ENERGY_ICON_EMPTY, GLYPHS } from './assets.js';
import { cardBack, cardFace } from './card-view.js';
import { createBoardView } from './board-view.js';
import { el, qs, setChildren } from './dom.js';

const INSTINCT_LABEL = {
  [INSTINCTS.FUYARD]: 'Fuyard',
  [INSTINCTS.CHAROGNARD]: 'Charognard',
  [INSTINCTS.PROTECTEUR]: 'Protecteur',
  [INSTINCTS.TERRITORIAL]: 'Territorial',
  [INSTINCTS.DOMINANT]: 'Dominant',
  [INSTINCTS.CHASSEUR]: 'Chasseur',
};

const INSTINCT_RULE = {
  [INSTINCTS.FUYARD]: "N'attaque jamais. S'éloigne de l'ennemi le plus proche qu'il voit.",
  [INSTINCTS.CHAROGNARD]: 'Traque les blessés (sous 50 % de PV), sinon rejoint le dernier combat perçu.',
  [INSTINCTS.PROTECTEUR]: "S'interpose et absorbe les dégâts destinés à l'allié qu'il protège.",
  [INSTINCTS.TERRITORIAL]: 'Ne quitte jamais sa région. Voit sa région et ce qui la borde.',
  [INSTINCTS.DOMINANT]: 'Ne frappe que fuyards et charognards. Encaisse le reste sans riposter.',
  [INSTINCTS.CHASSEUR]: "Fonce sur l'ennemi le plus proche dans sa vision.",
};

export function createGameScreen(root, handlers) {
  const boardHost = el('div', { class: 'hote-plateau' });
  const boardView = createBoardView(boardHost, {
    onCell: handlers.onCellClick,
    onHoverCell: handlers.onCellHover,
  });

  const adversaire = el('header', { class: 'bandeau adversaire' });
  const inspecteur = el('aside', { class: 'inspecteur' });
  const barre = el('footer', { class: 'bandeau joueur' });

  // Couche où volent les cartes animées, au-dessus de tout le reste.
  const coucheCartes = el('div', { class: 'couche-cartes' });

  const screen = el(
    'div',
    { class: 'ecran-partie' },
    adversaire,
    el('div', { class: 'aire' }, boardHost, inspecteur),
    barre,
    coucheCartes
  );
  root.append(screen);

  // ---------------------------------------------------------------------
  // Bandeau adverse
  // ---------------------------------------------------------------------

  function renderAdversaire(state, ui) {
    const id = 1 - state.activePlayer;
    const player = state.players[id];
    setChildren(
      adversaire,
      el('span', { class: 'qui', dataOwner: id }, 'Adversaire'),
      energyGauge(player.energy),
      el(
        'div',
        { class: 'dos-cartes', title: `${player.hand.length} carte(s) en main` },
        ...player.hand.map(() => cardBack())
      ),
      el('span', { class: 'compteur' }, pluriel(countCreatures(state, id), 'créature')),
      ui.debug ? el('span', { class: 'etiquette-debug' }, 'DEBUG') : null
    );
  }

  // ---------------------------------------------------------------------
  // Inspecteur
  // ---------------------------------------------------------------------

  function renderInspecteur(state, ui) {
    const creature = ui.selectedId ? creatureById(state, ui.selectedId) : null;
    setChildren(
      inspecteur,
      creature ? ficheCreature(state, creature) : ficheVide(state),
      journal(state),
      outils(state, ui)
    );
  }

  function ficheVide(state) {
    return el(
      'section',
      { class: 'fiche vide' },
      el('h2', {}, 'Inspecteur'),
      el('p', {}, 'Survolez une créature pour lire sa vision, sa cible et sa prochaine case. Cliquez pour l’épingler ici.'),
      el(
        'dl',
        { class: 'stats-globales' },
        ligne('Manche', state.round),
        ligne('Créatures', `${countCreatures(state, 0)} / ${countCreatures(state, 1)}`),
        state.round >= BALANCE.suddenDeath.startRound ? ligne('Mort subite', 'active') : null
      )
    );
  }

  function ficheCreature(state, creature) {
    const s = stats(state, creature);
    const biome = BIOME_META[state.board.tiles[creature.cell]];
    return el(
      'section',
      { class: 'fiche', dataOwner: creature.owner },
      el(
        'header',
        {},
        el('i', { class: 'glyphe-fiche', html: GLYPHS[creature.instinct] }),
        el('h2', {}, INSTINCT_LABEL[creature.instinct]),
        el('span', { class: 'appartenance' }, `Joueur ${creature.owner + 1}`)
      ),
      el(
        'div',
        { class: 'chiffres' },
        chiffre('PV', `${creature.hp}/${creature.maxHp}`),
        chiffre('ATK', s.atk),
        chiffre('VIT', s.speed),
        chiffre('VUE', creature.instinct === INSTINCTS.TERRITORIAL ? 'zone' : s.vision)
      ),
      el('p', { class: 'regle' }, INSTINCT_RULE[creature.instinct]),
      el('p', { class: 'terrain' }, `Sur ${biome.label} — vision ${biome.visionMod >= 0 ? '+' : ''}${biome.visionMod}`),
      creature.effects.length
        ? el(
            'ul',
            { class: 'effets' },
            ...creature.effects.map((e) =>
              el('li', {}, `${effetLabel(e.kind)}${e.remaining === null ? '' : ` · ${e.remaining} tour(s)`}`)
            )
          )
        : null
    );
  }

  const effetLabel = (kind) =>
    ({ frenesie: 'Frénésie', carapace: 'Carapace', panique: 'Panique', obsession: 'Obsession' })[kind] ?? kind;

  function journal(state) {
    const lignes = state.log.slice(-40).reverse();
    return el(
      'section',
      { class: 'journal' },
      el('h2', {}, 'Journal'),
      el('ol', {}, ...lignes.map((l) => el('li', { dataOwner: l.player }, l.text)))
    );
  }

  function outils(state, ui) {
    return el(
      'section',
      { class: 'outils' },
      el(
        'button',
        { type: 'button', onclick: handlers.onReplay, disabled: !state.lastTurnEvents?.length },
        'Rejouer le dernier tour'
      ),
      el(
        'label',
        { class: 'bascule' },
        el('input', { type: 'checkbox', checked: ui.debug, onchange: handlers.onDebugToggle }),
        'Mode debug'
      ),
      ui.debug ? el('button', { type: 'button', onclick: handlers.onSkipTurn }, 'Avancer d’un tour à vide') : null
    );
  }

  // ---------------------------------------------------------------------
  // Bandeau du joueur actif
  // ---------------------------------------------------------------------

  function renderBarre(state, ui) {
    if (state.phase === 'placement') {
      setChildren(
        barre,
        el('p', { class: 'consigne-placement' },
          'Chaque joueur pose gratuitement un fuyard. S’il meurt avant que vous n’ayez posé autre chose, vous perdez.')
      );
      return;
    }
    const player = state.players[state.activePlayer];
    const chrono = el(
      'div',
      { class: 'chrono', dataUrgent: ui.secondsLeft <= 5 ? '' : null },
      String(Math.max(0, ui.secondsLeft)).padStart(2, '0'),
      el('small', {}, 's')
    );

    setChildren(
      barre,
      el(
        'div',
        { class: 'ligne-haute' },
        el('span', { class: 'qui', dataOwner: player.id }, `Joueur ${player.id + 1}`),
        energyGauge(player.energy),
        chrono,
        ui.pendingCard || ui.pendingSummon
          ? el('button', { class: 'annuler', type: 'button', onclick: handlers.onCancel }, 'Annuler')
          : null,
        el(
          'button',
          {
            class: 'fin-tour',
            type: 'button',
            onclick: handlers.onEndTurn,
            disabled: state.pendingDiscard !== null,
          },
          'Fin de tour'
        )
      ),
      el('div', { class: 'ligne-basse' }, pioche(state), main(state, ui), invocations(state, ui))
    );
  }

  /** Pile de pioche : point de départ et d'arrivée des animations de carte. */
  function pioche(state) {
    const player = state.players[state.activePlayer];
    return el(
      'div',
      { class: 'pioche', title: `${player.draw.length} carte(s) dans la pioche` },
      cardBack(),
      el('span', { class: 'nombre-pioche' }, player.draw.length)
    );
  }

  function main(state, ui) {
    const player = state.players[state.activePlayer];
    const jouables = playableCards(state, state.activePlayer);
    const enDefausse = state.pendingDiscard === player.id;

    return el(
      'div',
      { class: 'main', dataDefausse: enDefausse ? '' : null },
      enDefausse ? el('p', { class: 'consigne' }, 'Main pleine : défaussez une carte.') : null,
      ...jouables.map((entry, i) => {
        const card = entry.card;
        return el(
          'button',
          {
            class: 'carte',
            type: 'button',
            dataCategorie: card.category,
            dataActive: ui.pendingCard === entry.cardId ? '' : null,
            disabled: !enDefausse && !entry.legal,
            title: entry.legal || enDefausse ? card.text : raisonRefus(entry, state),
            style: { '--i': i - (jouables.length - 1) / 2 },
            onclick: () => (enDefausse ? handlers.onDiscard(entry.cardId) : handlers.onCardClick(entry.cardId)),
            onmouseenter: () => handlers.onCardHover(entry.cardId),
            onmouseleave: () => handlers.onCardHover(null),
          },
          ...cardFace(card)
        );
      }),
      ...Array.from({ length: BALANCE.hand.max - player.hand.length }, () => el('div', { class: 'carte vide' }))
    );
  }

  const raisonRefus = (entry, state) =>
    !entry.affordable
      ? `Il faut ${entry.card.cost} énergie (vous en avez ${state.players[state.activePlayer].energy}).`
      : 'Aucune cible légale sur le plateau.';

  function invocations(state, ui) {
    const options = summonOptions(state, state.activePlayer);
    return el(
      'div',
      { class: 'invocations' },
      el('h3', {}, 'Invoquer'),
      el(
        'div',
        { class: 'boutons' },
        ...options.map((option) =>
          el(
            'button',
            {
              class: 'invocation',
              type: 'button',
              dataInstinct: option.instinct,
              dataActive: ui.pendingSummon === option.instinct ? '' : null,
              disabled: !option.legal,
              title: option.alreadySummoned
                ? 'Déjà invoqué ce tour-ci.'
                : `${INSTINCT_LABEL[option.instinct]} — ${INSTINCT_RULE[option.instinct]}`,
              onclick: () => handlers.onSummonClick(option.instinct),
              onmouseenter: () => handlers.onSummonHover(option.instinct),
              onmouseleave: () => handlers.onSummonHover(null),
            },
            el('i', { class: 'glyphe-bouton', html: GLYPHS[option.instinct] }),
            el('span', { class: 'nom' }, INSTINCT_LABEL[option.instinct]),
            el('span', { class: 'cout' }, option.cost)
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------------

  function energyGauge(energy) {
    return el(
      'div',
      { class: 'energie', title: `${energy}/${BALANCE.energy.max} énergie` },
      el('span', { class: 'valeur' }, `${energy}/${BALANCE.energy.max}`),
      el(
        'span',
        { class: 'cristaux' },
        ...Array.from({ length: BALANCE.energy.max }, (_, i) =>
          el('i', { class: i < energy ? 'plein' : 'vide', html: i < energy ? ENERGY_ICON : ENERGY_ICON_EMPTY })
        )
      )
    );
  }

  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

  const countCreatures = (state, player) =>
    state.creatures.filter((c) => c.owner === player && c.hp > 0).length;

  const ligne = (k, v) => el('div', { class: 'ligne' }, el('dt', {}, k), el('dd', {}, String(v)));
  const chiffre = (k, v) => el('div', { class: 'chiffre' }, el('b', {}, String(v)), el('span', {}, k));

  return {
    element: screen,
    boardView,
    render(state, ui) {
      boardView.render(state);
      boardView.setSelected(ui.selectedId);
      renderAdversaire(state, ui);
      renderInspecteur(state, ui);
      renderBarre(state, ui);
    },
    /** Éléments dont les animations de carte ont besoin. */
    coucheCartes,
    pileEl: () => qs('.pioche', barre),
    handEl: () => qs('.main', barre),
    setTimer(seconds, urgent) {
      const chrono = qs('.chrono', barre);
      if (!chrono) return;
      chrono.firstChild.textContent = String(Math.max(0, seconds)).padStart(2, '0');
      chrono.toggleAttribute('data-urgent', urgent);
    },
  };
}
