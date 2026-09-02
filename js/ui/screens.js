/**
 * Écrans hors partie : accueil, construction de deck, écran de passage
 * hot-seat, fin de partie, règles.
 */

import { BALANCE, CARDS, INSTINCTS, INSTINCT_LABEL, BIOME_META, BIOME_LIST } from '../engine/index.js';
import { GLYPHS, LOGO } from './assets.js';
import { cardFace } from './card-view.js';
import { el } from './dom.js';

/** Accueil : titre, nouvelle partie, reprise, règles. */
export function homeScreen({ onStart, onResume, onRules, hasSave }) {
  return el(
    'div',
    { class: 'ecran accueil' },
    el('i', { class: 'logo', html: LOGO }),
    el('p', { class: 'accroche' }, 'On ne déplace jamais ses créatures. On agit sur ce qui les gouverne.'),
    el(
      'div',
      { class: 'actions' },
      el('button', { class: 'primaire', type: 'button', onclick: onStart }, 'Nouvelle partie'),
      hasSave ? el('button', { type: 'button', onclick: onResume }, 'Reprendre la partie') : null,
      el('button', { type: 'button', onclick: onRules }, 'Règles')
    ),
    el('p', { class: 'note' }, 'Deux joueurs, un seul écran. Une partie dure une dizaine de minutes.')
  );
}

/** Construction de deck : 6 cartes parmi les 16, sans doublon (§5). */
export function deckScreen({ player, onValidate }) {
  const chosen = new Set();
  const compteur = el('span', { class: 'compteur' }, `0/${BALANCE.deck.size}`);
  const valider = el(
    'button',
    { class: 'primaire', type: 'button', disabled: true, onclick: () => onValidate([...chosen]) },
    'Valider ce deck'
  );

  const cartes = CARDS.map((card) =>
    el(
      'button',
      {
        class: 'carte choix',
        type: 'button',
        dataCategorie: card.category,
        onclick: (event) => toggle(card, event.currentTarget),
      },
      ...cardFace(card, { bande: true })
    )
  );

  function toggle(card, node) {
    if (chosen.has(card.id)) chosen.delete(card.id);
    else if (chosen.size < BALANCE.deck.size) chosen.add(card.id);
    else return;
    node.toggleAttribute('data-choisie', chosen.has(card.id));
    compteur.textContent = `${chosen.size}/${BALANCE.deck.size}`;
    valider.disabled = chosen.size !== BALANCE.deck.size;
    for (const [i, c] of CARDS.entries()) {
      cartes[i].disabled = !chosen.has(c.id) && chosen.size >= BALANCE.deck.size;
    }
  }

  return el(
    'div',
    { class: 'ecran deck' },
    el(
      'header',
      {},
      el('h1', {}, `Joueur ${player + 1} — construisez votre deck`),
      el('p', {}, 'Six cartes, sans doublon. Le deck est cyclique : une carte jouée revient en bas de la pioche.'),
      compteur
    ),
    el('div', { class: 'grille-cartes' }, ...cartes),
    el('footer', {}, valider)
  );
}

/** Placement du Roi. */
export function placementBanner(player) {
  return el(
    'div',
    { class: 'banniere' },
    el('strong', {}, `Joueur ${player + 1}`),
    ' — placez votre Roi sur votre moitié de plateau. Tout se joue autour de lui.'
  );
}

/**
 * Écran de passage hot-seat : masque les mains entre deux tours ; le chrono ne
 * démarre qu'après validation (§6.11).
 */
export function passScreen({ player, round, state, onContinue }) {
  const vivantes = (p) => state.creatures.filter((c) => c.owner === p && c.hp > 0).length;
  return el(
    'div',
    { class: 'ecran passage', dataOwner: player },
    el('p', { class: 'sur-titre' }, `Manche ${round}`),
    el('h1', {}, `Au tour du Joueur ${player + 1}`),
    el('p', {}, 'Passez l’écran à l’autre joueur, puis continuez.'),
    // Uniquement de l'information publique : les mains restent masquées.
    el(
      'dl',
      { class: 'bilan resume' },
      bilan('Vos créatures', vivantes(player)),
      bilan('Créatures adverses', vivantes(1 - player)),
      bilan('Votre énergie', `${state.players[player].energy}/${BALANCE.energy.max}`),
      state.round >= BALANCE.suddenDeath.startRound ? bilan('Mort subite', 'active') : null
    ),
    el('button', { class: 'primaire', type: 'button', onclick: onContinue }, 'Continuer')
  );
}

/** Fin de partie : vainqueur, durée, créatures tuées. */
export function gameOverScreen({ state, durationMs, onReplay, onHome }) {
  const minutes = Math.floor(durationMs / 60000);
  const secondes = Math.floor((durationMs % 60000) / 1000);
  const titre =
    state.winner === 'draw' ? 'Match nul' : `Le Joueur ${state.winner + 1} l’emporte`;

  return el(
    'div',
    { class: 'ecran fin', dataOwner: state.winner === 'draw' ? null : state.winner },
    el('h1', {}, titre),
    el(
      'dl',
      { class: 'bilan' },
      bilan('Durée', `${minutes} min ${String(secondes).padStart(2, '0')} s`),
      bilan('Manches', state.round),
      bilan('Créatures tuées — Joueur 1', state.players[0].kills),
      bilan('Créatures tuées — Joueur 2', state.players[1].kills),
      bilan('Fin', state.endedReason === 'regicide' ? 'Régicide' : state.endedReason ?? '—')
    ),
    el(
      'div',
      { class: 'actions' },
      el('button', { class: 'primaire', type: 'button', onclick: onReplay }, 'Rejouer'),
      el('button', { type: 'button', onclick: onHome }, 'Accueil')
    )
  );
}

const bilan = (k, v) => el('div', { class: 'ligne' }, el('dt', {}, k), el('dd', {}, String(v)));

/** Règles, en une page. */
export function rulesScreen({ onBack }) {
  return el(
    'div',
    { class: 'ecran regles' },
    el('h1', {}, 'Règles'),
    section('Le principe', [
      'Vous ne déplacez jamais vos créatures : chacune obéit à un instinct, un algorithme simple et prévisible.',
      'Vous agissez indirectement — invoquer, changer les instincts, transformer le terrain, buffer et débuffer.',
      'Chaque joueur pose un Roi avant la partie. Vous gagnez en tuant le Roi adverse.',
      'Le Roi ne se régénère jamais : chaque point de vie que vous lui prenez est acquis.',
    ]),
    section('Une manche', [
      `+${BALANCE.energy.perTurn} énergie (plafond ${BALANCE.energy.max}), puis une carte piochée.`,
      `Vos actions, dans l’ordre que vous voulez, en ${BALANCE.turn.seconds} secondes.`,
      'Puis toutes les créatures des deux joueurs bougent, puis tous les combats se résolvent en même temps.',
      'Enfin, les créatures qui n’ont ni frappé ni été touchées regagnent 1 PV.',
    ]),
    section('Le Roi', [
      'Il fuit l’ennemi le plus proche qu’il voit et ne frappe qu’en riposte.',
      'Aucune carte ne peut détourner son comportement : ni panique, ni obsession, ni changement d’instinct, ni leurre.',
      'Il ne se régénère jamais. Le Tueur de Roi, lui, sait toujours où il est.',
    ]),
    section('À savoir', [
      'Les distances se comptent en cases, diagonales comprises. La portée d’attaque est de 1.',
      'Une créature ne traverse jamais une case occupée ni une montagne.',
      `À partir de la manche ${BALANCE.suddenDeath.startRound}, la mort subite ronge toutes les créatures.`,
    ]),
    el(
      'div',
      { class: 'colonnes' },
      el(
        'section',
        {},
        el('h2', {}, 'Les six instincts'),
        el(
          'ul',
          { class: 'liste-instincts' },
          ...Object.entries(INSTINCT_TEXTE).map(([instinct, texte]) =>
            el(
              'li',
              {},
              el('i', { class: 'glyphe-regle', html: GLYPHS[instinct] }),
              el('b', {}, texte.nom),
              el('span', {}, texte.regle),
              el('em', {}, statLine(instinct))
            )
          )
        )
      ),
      el(
        'section',
        {},
        el('h2', {}, 'Les biomes'),
        el(
          'ul',
          { class: 'liste-biomes' },
          ...BIOME_LIST.map((biome) =>
            el(
              'li',
              { dataBiome: biome },
              el('b', {}, BIOME_META[biome].label),
              el(
                'span',
                {},
                biome === 'montagne'
                  ? 'Infranchissable. Bloque le mouvement et la vue des chemins.'
                  : `Vision ${BIOME_META[biome].visionMod >= 0 ? '+' : ''}${BIOME_META[biome].visionMod} pour qui s’y tient.`
              )
            )
          )
        )
      )
    ),
    el('button', { class: 'primaire', type: 'button', onclick: onBack }, 'Retour')
  );
}

const statLine = (instinct) => {
  const s = BALANCE.creatures[instinct];
  return `${s.cost}⚡ · ${s.hp} PV · ${s.atk} ATK · vitesse ${s.speed}`;
};

const INSTINCT_TEXTE = {
  [INSTINCTS.ROI]: { nom: INSTINCT_LABEL[INSTINCTS.ROI], regle: 'Fuit le combat, riposte, ne se régénère jamais. Sa mort finit la partie.' },
  [INSTINCTS.PROTECTEUR]: { nom: INSTINCT_LABEL[INSTINCTS.PROTECTEUR], regle: 'S’interpose et encaisse à la place d’un allié.' },
  [INSTINCTS.TERRITORIAL]: { nom: INSTINCT_LABEL[INSTINCTS.TERRITORIAL], regle: 'Ne quitte jamais sa région, voit ce qui la borde.' },
  [INSTINCTS.CHASSEUR]: { nom: INSTINCT_LABEL[INSTINCTS.CHASSEUR], regle: 'Fonce sur l’ennemi le plus proche.' },
  [INSTINCTS.TUEUR_DE_ROI]: { nom: INSTINCT_LABEL[INSTINCTS.TUEUR_DE_ROI], regle: 'Va droit sur le Roi adverse. Ne frappe que lui.' },
};

const section = (titre, points) =>
  el('section', {}, el('h2', {}, titre), el('ul', {}, ...points.map((p) => el('li', {}, p))));
